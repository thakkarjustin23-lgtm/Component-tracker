import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "data", "db.json");

// Define TypeScript interfaces to match data/db.json
interface Component {
  id: string;
  name: string;
  category: string;
  totalStock: number;
  availableStock: number;
  location: string;
  condition: "Excellent" | "Good" | "Needs Attention";
  description: string;
  schoolId?: string; // Opt-in scoping
}

interface Checkout {
  id: string;
  componentId: string;
  componentName: string;
  studentName: string;
  studentEmail: string;
  quantity: number;
  checkoutDate: string;
  dueDate: string;
  returnedDate: string | null;
  status: "active" | "returned" | "overdue";
  alertsSent: number;
  lastAlertDate: string | null;
  schoolId?: string; // Opt-in scoping
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: "checkout" | "return" | "alert" | "inventory" | "system";
  message: string;
  schoolId?: string; // Opt-in scoping
}

interface School {
  id: string;
  name: string;
  passkey: string;
  firstLogin: boolean;
}

interface Student {
  id: string;
  name: string;
  email: string;
  code: string;
  passkey: string;
  schoolId: string;
}

interface DBStructure {
  components: Component[];
  checkouts: Checkout[];
  logs: LogEntry[];
  schools: School[];
  students: Student[];
}

// Ensure database file and directories exist
function ensureDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seedData: DBStructure = {
      components: [],
      checkouts: [],
      logs: [{
        id: "log-init",
        timestamp: new Date().toISOString(),
        type: "system",
        message: "Robotics component tracker database initialized."
      }],
      schools: [
        {
          id: "LINCOLN",
          name: "Lincoln High School",
          passkey: "robotics",
          firstLogin: true
        }
      ],
      students: [
        {
          id: "stu-default",
          name: "Alex Rivera",
          email: "arivera.student@school.edu",
          code: "STU-8822",
          passkey: "1234",
          schoolId: "LINCOLN"
        }
      ]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(seedData, null, 2), "utf-8");
  }
}

async function readDb(): Promise<DBStructure> {
  ensureDb();
  const raw = await fs.promises.readFile(DB_FILE, "utf-8");
  const data = JSON.parse(raw) as any;
  
  // Guarantee arrays exist for backward compatibility
  if (!data.components) data.components = [];
  if (!data.checkouts) data.checkouts = [];
  if (!data.logs) data.logs = [];
  if (!data.schools) {
    data.schools = [
      {
        id: "LINCOLN",
        name: "Lincoln High School",
        passkey: "robotics",
        firstLogin: true
      }
    ];
  }
  if (!data.students) {
    data.students = [
      {
        id: "stu-default",
        name: "Alex Rivera",
        email: "arivera.student@school.edu",
        code: "STU-8822",
        passkey: "1234",
        schoolId: "LINCOLN"
      }
    ];
  }

  // Backfill schoolId for legacy items
  data.components = data.components.map((c: any) => {
    if (!c.schoolId) c.schoolId = "LINCOLN";
    return c;
  });
  data.checkouts = data.checkouts.map((chk: any) => {
    if (!chk.schoolId) chk.schoolId = "LINCOLN";
    return chk;
  });
  data.logs = data.logs.map((l: any) => {
    if (!l.schoolId) l.schoolId = "LINCOLN";
    return l;
  });

  // Dynamic overdue updates based on current date
  const todayStr = new Date().toISOString().split("T")[0];
  let changed = false;
  
  data.checkouts = data.checkouts.map((chk: any) => {
    if (chk.returnedDate === null && chk.dueDate < todayStr && chk.status !== "overdue") {
      chk.status = "overdue";
      changed = true;
      
      // Auto register a system log for overdue items
      data.logs.unshift({
        id: `auto-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        type: "system",
        message: `System flagged checkout of "${chk.componentName}" for ${chk.studentName} as OUTSTANDING/OVERDUE.`,
        schoolId: chk.schoolId || "LINCOLN"
      });
    }
    return chk;
  });

  if (changed) {
    await fs.promises.writeFile(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  }
  
  return data as DBStructure;
}

async function writeDb(data: DBStructure): Promise<void> {
  ensureDb();
  await fs.promises.writeFile(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// Lazy Gemini API instantiation
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in Server Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Helper to extract schoolId from request headers
  function getSchoolId(req: any): string {
    const h = req.headers["x-school-id"];
    if (Array.isArray(h)) return h[0] || "LINCOLN";
    return (h as string) || "LINCOLN";
  }

  // API Routes

  // Auth 1: Register new school
  app.post("/api/auth/school/register", async (req, res) => {
    try {
      const { id, name, passkey } = req.body;
      if (!id || !name || !passkey) {
        return res.status(400).json({ error: "School registration requires a distinct Code, full Name, and secure Password." });
      }

      const dbData = await readDb();
      const codeUpper = id.trim().toUpperCase();

      if (dbData.schools.some(s => s.id === codeUpper)) {
        return res.status(400).json({ error: `School administrative code "${codeUpper}" is already registered.` });
      }

      const newSchool: School = {
        id: codeUpper,
        name: name.trim(),
        passkey: passkey.trim(),
        firstLogin: true
      };

      dbData.schools.push(newSchool);
      
      // Initialize system log for this school
      dbData.logs.unshift({
        id: `sys-log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "system",
        message: `New school registered: "${newSchool.name}" [Code: ${newSchool.id}]`,
        schoolId: codeUpper
      });

      await writeDb(dbData);
      res.status(201).json({ success: true, school: newSchool });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to register school", details: err.message });
    }
  });

  // Auth 2: Login school
  app.post("/api/auth/school/login", async (req, res) => {
    try {
      const { id, passkey } = req.body;
      if (!id || !passkey) {
        return res.status(400).json({ error: "Please enter your School Code and Passkey." });
      }

      const dbData = await readDb();
      const codeUpper = id.trim().toUpperCase();
      const school = dbData.schools.find(s => s.id === codeUpper && s.passkey === passkey.trim());

      if (!school) {
        return res.status(401).json({ error: "Authentication failed. Invalid School Code or Password." });
      }

      res.json({ success: true, school });
    } catch (err: any) {
      res.status(500).json({ error: "Failed school login", details: err.message });
    }
  });

  // Auth 3: Dismiss walkthrough guide
  app.post("/api/auth/school/dismiss-guide", async (req, res) => {
    try {
      const schoolId = getSchoolId(req);
      const dbData = await readDb();
      const school = dbData.schools.find(s => s.id === schoolId);

      if (school) {
        school.firstLogin = false;
        await writeDb(dbData);
      }

      res.json({ success: true, school });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to dismiss startup onboarding guide", details: err.message });
    }
  });

  // Auth 4: Student Code & Passkey Login
  app.post("/api/auth/student/login", async (req, res) => {
    try {
      const { code, passkey } = req.body;
      if (!code || !passkey) {
        return res.status(400).json({ error: "Please enter your unique Student Code and PIN passkey." });
      }

      const dbData = await readDb();
      const student = dbData.students.find(
        s => s.code.trim().toUpperCase() === code.trim().toUpperCase() && s.passkey.trim() === passkey.trim()
      );

      if (!student) {
        return res.status(401).json({ error: "Invalid Student Code or security passkey PIN." });
      }

      const school = dbData.schools.find(s => s.id === student.schoolId);

      res.json({
        success: true,
        student,
        schoolName: school ? school.name : "Registered Robotics Laboratory"
      });
    } catch (err: any) {
      res.status(500).json({ error: "Student authorization failed", details: err.message });
    }
  });

  // 1. Get all data scoped by school Id
  app.get("/api/data", async (req, res) => {
    try {
      const schoolId = getSchoolId(req);
      const dbData = await readDb();

      // Filter arrays by active school scope
      const components = dbData.components.filter(c => c.schoolId === schoolId);
      const checkouts = dbData.checkouts.filter(chk => chk.schoolId === schoolId);
      const logs = dbData.logs.filter(l => l.schoolId === schoolId);
      const students = dbData.students.filter(s => s.schoolId === schoolId);

      res.json({
        components,
        checkouts,
        logs,
        students,
        schools: dbData.schools
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to read database state", details: err.message });
    }
  });

  // Students Directory lists
  app.get("/api/students", async (req, res) => {
    try {
      const schoolId = getSchoolId(req);
      const dbData = await readDb();
      const students = dbData.students.filter(s => s.schoolId === schoolId);
      res.json(students);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to query students registry", details: err.message });
    }
  });

  app.post("/api/students", async (req, res) => {
    try {
      const schoolId = getSchoolId(req);
      const { name, email, passkey } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: "Student profile creation requires a Name and unique Email address." });
      }

      const dbData = await readDb();

      // Generate a structured student code and 4-digit numeric PIN
      const schoolPrefix = schoolId.length >= 3 ? schoolId.substring(0, 3).toUpperCase() : "STU";
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const studentCode = `STU-${schoolPrefix}-${randomSuffix}`;
      const studentPasskey = passkey || String(Math.floor(1000 + Math.random() * 9000));

      const newStudent: Student = {
        id: `stu-${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        code: studentCode,
        passkey: studentPasskey,
        schoolId
      };

      dbData.students.push(newStudent);
      
      dbData.logs.unshift({
        id: `log-dir-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "system",
        message: `Registered student credential profile: ${newStudent.name} (Code: ${studentCode}, PIN: ${studentPasskey})`,
        schoolId
      });

      await writeDb(dbData);
      res.status(201).json(newStudent);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to create student account", details: err.message });
    }
  });

  // 2. Add structural component to inventory
  app.post("/api/components", async (req, res) => {
    try {
      const schoolId = getSchoolId(req);
      const { name, category, totalStock, location, condition, description } = req.body;
      if (!name || !category || typeof totalStock !== "number" || totalStock < 0) {
        return res.status(400).json({ error: "Invalid component schema." });
      }

      const dbData = await readDb();
      const newComp: Component = {
        id: `comp-${Date.now()}`,
        name,
        category,
        totalStock,
        availableStock: totalStock, // initially fully available
        location: location || "Unassigned",
        condition: condition || "Excellent",
        description: description || "",
        schoolId
      };

      dbData.components.unshift(newComp);
      dbData.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "inventory",
        message: `Added new component "${name}" with initial stock of ${totalStock} to ${newComp.location}.`,
        schoolId
      });

      await writeDb(dbData);
      res.status(201).json(newComp);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to add component", details: err.message });
    }
  });

  // 3. Edit structural component (and update stock ratios)
  app.put("/api/components/:id", async (req, res) => {
    try {
      const schoolId = getSchoolId(req);
      const compId = req.params.id;
      const { name, category, totalStock, location, condition, description } = req.body;
      const dbData = await readDb();

      const index = dbData.components.findIndex(c => c.id === compId && c.schoolId === schoolId);
      if (index === -1) {
        return res.status(404).json({ error: "Component not found in your school records." });
      }

      const previous = dbData.components[index];
      
      // Calculate checkout count to adjust availableStock accurately
      const activeCheckouts = dbData.checkouts.filter(chk => chk.componentId === compId && chk.returnedDate === null);
      const currentlyCheckedOutTotal = activeCheckouts.reduce((sum, chk) => sum + chk.quantity, 0);

      if (totalStock < currentlyCheckedOutTotal) {
        return res.status(400).json({ 
          error: `Cannot reduce total stock to ${totalStock} because ${currentlyCheckedOutTotal} units are currently checked out by students.` 
        });
      }

      const updatedComp: Component = {
        ...previous,
        name: name || previous.name,
        category: category || previous.category,
        totalStock: typeof totalStock === "number" ? totalStock : previous.totalStock,
        availableStock: (typeof totalStock === "number" ? totalStock : previous.totalStock) - currentlyCheckedOutTotal,
        location: location || previous.location,
        condition: condition || previous.condition,
        description: description || previous.description
      };

      dbData.components[index] = updatedComp;
      dbData.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "inventory",
        message: `Updated component properties for "${updatedComp.name}". New Total Stock: ${updatedComp.totalStock}, Available: ${updatedComp.availableStock}.`,
        schoolId
      });

      await writeDb(dbData);
      res.json(updatedComp);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update component", details: err.message });
    }
  });

  // 4. Delete component safely
  app.delete("/api/components/:id", async (req, res) => {
    try {
      const schoolId = getSchoolId(req);
      const compId = req.params.id;
      const dbData = await readDb();

      const index = dbData.components.findIndex(c => c.id === compId && c.schoolId === schoolId);
      if (index === -1) {
        return res.status(404).json({ error: "Component not found." });
      }

      // Check if there are any active borrowings
      const hasActiveCheckout = dbData.checkouts.some(chk => chk.componentId === compId && chk.returnedDate === null);
      if (hasActiveCheckout) {
        return res.status(400).json({ 
          error: "Cannot delete component while active copies are checked out by students." 
        });
      }

      const compName = dbData.components[index].name;
      dbData.components.splice(index, 1);
      dbData.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "inventory",
        message: `Removed component "${compName}" from lab inventory tracker.`,
        schoolId
      });

      await writeDb(dbData);
      res.json({ success: true, message: "Component removed from inventory." });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete component", details: err.message });
    }
  });

  // 5. Checkout Component
  app.post("/api/checkouts", async (req, res) => {
    try {
      const schoolId = getSchoolId(req);
      const { componentId, studentName, studentEmail, quantity, dueDate } = req.body;
      if (!componentId || !studentName || !studentEmail || typeof quantity !== "number" || quantity <= 0 || !dueDate) {
        return res.status(400).json({ error: "Invalid checkout request schema." });
      }

      const dbData = await readDb();
      const compIndex = dbData.components.findIndex(c => c.id === componentId && c.schoolId === schoolId);
      if (compIndex === -1) {
        return res.status(404).json({ error: "Target component does not exist under your school record." });
      }

      const component = dbData.components[compIndex];
      if (component.availableStock < quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock. Requested: ${quantity}, Available: ${component.availableStock}.` 
        });
      }

      // 1. Retrieve or automatically register student credentials
      let student = dbData.students.find(
        s => s.email.toLowerCase() === studentEmail.toLowerCase() && s.schoolId === schoolId
      );

      let wasAutoRegistered = false;
      let generatedCode = "";
      let generatedPasskey = "";

      if (!student) {
        // Automatically create security credentials for this student
        const schoolPrefix = schoolId.length >= 3 ? schoolId.substring(0, 3).toUpperCase() : "STU";
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        generatedCode = `STU-${schoolPrefix}-${randomSuffix}`;
        generatedPasskey = String(Math.floor(1000 + Math.random() * 9000));

        student = {
          id: `stu-${Date.now()}`,
          name: studentName.trim(),
          email: studentEmail.trim().toLowerCase(),
          code: generatedCode,
          passkey: generatedPasskey,
          schoolId
        };
        dbData.students.push(student);
        wasAutoRegistered = true;

        // Add to class logs
        dbData.logs.unshift({
          id: `auth-log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "system",
          message: `Auto-generated login credentials for newly encountered student ${studentName}: Code: ${generatedCode}, Pass: ${generatedPasskey}`,
          schoolId
        });
      }

      // Deduct available stock
      component.availableStock -= quantity;

      const todayStr = new Date().toISOString().split("T")[0];
      const status = dueDate < todayStr ? "overdue" : "active";

      const newCheckout: Checkout = {
        id: `chk-${Date.now()}`,
        componentId,
        componentName: component.name,
        studentName: student.name,
        studentEmail: student.email,
        quantity,
        checkoutDate: todayStr,
        dueDate,
        returnedDate: null,
        status,
        alertsSent: 0,
        lastAlertDate: null,
        schoolId
      };

      dbData.checkouts.unshift(newCheckout);
      dbData.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "checkout",
        message: `${studentName} (${studentEmail}) checked out ${quantity}x "${component.name}". Due Date: ${dueDate}.`,
        schoolId
      });

      await writeDb(dbData);
      res.status(201).json({
        ...newCheckout,
        studentCreated: wasAutoRegistered,
        studentCode: student.code,
        studentPasskey: student.passkey
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to checkout component", details: err.message });
    }
  });

  // 6. Return Component
  app.post("/api/checkouts/:id/return", async (req, res) => {
    try {
      const schoolId = getSchoolId(req);
      const checkoutId = req.params.id;
      const dbData = await readDb();

      const chkIndex = dbData.checkouts.findIndex(c => c.id === checkoutId && c.schoolId === schoolId);
      if (chkIndex === -1) {
        return res.status(404).json({ error: "Checkout log entry not found in school bounds." });
      }

      const checkout = dbData.checkouts[chkIndex];
      if (checkout.returnedDate !== null) {
        return res.status(400).json({ error: "Component has already been recorded as returned." });
      }

      const compIndex = dbData.components.findIndex(c => c.id === checkout.componentId && c.schoolId === schoolId);
      if (compIndex !== -1) {
        dbData.components[compIndex].availableStock += checkout.quantity;
        // Correct overflow bounds just in case of manual stock level adjustments
        if (dbData.components[compIndex].availableStock > dbData.components[compIndex].totalStock) {
          dbData.components[compIndex].availableStock = dbData.components[compIndex].totalStock;
        }
      }

      const todayStr = new Date().toISOString().split("T")[0];
      checkout.returnedDate = todayStr;
      checkout.status = "returned";

      dbData.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "return",
        message: `${checkout.studentName} returned ${checkout.quantity}x "${checkout.componentName}" successfully.`,
        schoolId
      });

      await writeDb(dbData);
      res.json(checkout);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to return component", details: err.message });
    }
  });

  // 7. Draft Custom Alert Email with Gemini (AI Assist)
  app.post("/api/alert/draft", async (req, res) => {
    try {
      const schoolId = getSchoolId(req);
      const { checkoutId, tone } = req.body;
      if (!checkoutId || !tone) {
        return res.status(400).json({ error: "checkoutId and tone are required." });
      }

      const dbData = await readDb();
      const checkout = dbData.checkouts.find(c => c.id === checkoutId && c.schoolId === schoolId);
      if (!checkout) {
        return res.status(404).json({ error: "Checkout entry not found" });
      }

      const todayStr = new Date().toISOString().split("T")[0];
      const msDiff = new Date(todayStr).getTime() - new Date(checkout.dueDate).getTime();
      const daysOverdue = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)));

      // Call Gemini for context-aware reminder email
      try {
        const ai = getGeminiClient();
        
        let toneInstructions = "";
        if (tone === "friendly") {
          toneInstructions = "a warm, encouraging reminder. Focus on helping the student remember, keep it positive and open.";
        } else if (tone === "firm") {
          toneInstructions = "a direct and official tone. Highlight that other students are waiting for this piece of equipment to complete their robotics assignment, and state a return is required by tomorrow morning.";
        } else if (tone === "parent") {
          toneInstructions = "a highly professional, serious reminder addressed to both the student and cc: parent. Politely underscore the value of school robotics equipment and safety/care protocols, and request a parent signature or confirmation.";
        }

        const prompt = `You are the Lead Robotics Engineering Instructor and Lab Coordinator. 
You need to draft a custom return warning email alert to a student with the following checkout records:
- Student Name: ${checkout.studentName}
- Student Email: ${checkout.studentEmail}
- Borrowed Item: ${checkout.componentName} (qty: ${checkout.quantity})
- Checkout Date: ${checkout.checkoutDate}
- Scheduled Due Date: ${checkout.dueDate}
- Days Overdue: ${daysOverdue} days past the deadline.

Generate a highly specific, clean, and context-aware email template. Refine the writing style to sound like a real high school teacher based on this tone category: ${toneInstructions}.
Reference the specific item name "${checkout.componentName}" and mention typical lab projects if applicable (e.g. arduino coding, motor assemblies, sensor calibrations).

Return your response strictly in JSON format matching this schema:
{
  "subject": "The email subject line, matching the tone",
  "body": "The complete, fully formatted email message body with paragraph breaks. Use double newlines \\n\\n for formatting."
}`;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                subject: { type: Type.STRING, description: "A catchy but appropriate email subject line." },
                body: { type: Type.STRING, description: "The beautiful structured text representation of the email message." }
              },
              required: ["subject", "body"]
            }
          }
        });

        const outputText = response.text || "{}";
        const emailDraft = JSON.parse(outputText);
        res.json({
          studentName: checkout.studentName,
          studentEmail: checkout.studentEmail,
          componentName: checkout.componentName,
          subject: emailDraft.subject || "Robotics Equipment Return Reminder",
          body: emailDraft.body || "Please return your borrowed robotics equipment as soon as possible."
        });

      } catch (aiErr: any) {
        // Fallback email draft if Gemini API key is missing or calls fail, keeping UX intact
        console.warn("Gemini drafting fallback due to:", aiErr.message);
        
        let fallbackSubject = "";
        let fallbackBody = "";

        if (tone === "friendly") {
          fallbackSubject = `Friendly Reminder: Robotics Equipment Return – ${checkout.componentName}`;
          fallbackBody = `Hi ${checkout.studentName},\n\nJust a quick, friendly catch-up to remind you that the "${checkout.componentName}" you checked out on ${checkout.checkoutDate} was due back on ${checkout.dueDate} (currently ${daysOverdue} day(s) late).\n\nIf you have completed your assembly or tests, please drop it off at Cabinet drawer soon so another team can utilize it. Let me know if you need to renew!\n\nBest,\nLead Instructor\nRobotics Lab Coordinator`;
        } else if (tone === "firm") {
          fallbackSubject = `Action Required: OVERDUE Robotics Lab Equipment – ${checkout.componentName}`;
          fallbackBody = `Dear ${checkout.studentName},\n\nThis is an official notice that the following critical robotics lab component is now OVERDUE:\n\n- Component: ${checkout.quantity}x ${checkout.componentName}\n- Due Date: ${checkout.dueDate} (${daysOverdue} days past due)\n\nOur lab equipment is highly requested for current project assignments. Please return this item to the instructor desk immediately on your next school day.\n\nRegards,\nRobotics Engineering Department`;
        } else {
          fallbackSubject = `Notice of Unreturned School Property – Student: ${checkout.studentName}`;
          fallbackBody = `To the Parent/Guardian of ${checkout.studentName},\n\nWe are writing to coordinate the return of school robotics equipment checked out by ${checkout.studentName} for class laboratory activities. The item, ${checkout.quantity}x ${checkout.componentName}, is now ${daysOverdue} days overdue and must be accounted for.\n\nPlease discuss returning this component tomorrow model-build session so we can avoid replacement material logs.\n\nSincerely,\nRobotics Lab Administration`;
        }

        res.json({
          studentName: checkout.studentName,
          studentEmail: checkout.studentEmail,
          componentName: checkout.componentName,
          subject: fallbackSubject,
          body: fallbackBody,
          isFallback: true,
          notice: "Gemini AI draft helper is available as soon as your Server Secret key is added."
        });
      }

    } catch (err: any) {
      res.status(500).json({ error: "Failed to generate email alert draft", details: err.message });
    }
  });

  // 8. Confirm notification dispatch (Send Alert)
  app.post("/api/checkouts/:id/notify", async (req, res) => {
    try {
      const schoolId = getSchoolId(req);
      const checkoutId = req.params.id;
      const { emailSubject, emailBody } = req.body;
      const dbData = await readDb();

      const chkIndex = dbData.checkouts.findIndex(c => c.id === checkoutId && c.schoolId === schoolId);
      if (chkIndex === -1) {
        return res.status(404).json({ error: "Checkout log entry not found." });
      }

      const checkout = dbData.checkouts[chkIndex];
      const todayStr = new Date().toISOString().split("T")[0];
      
      // Update checkout alert record
      checkout.alertsSent += 1;
      checkout.lastAlertDate = todayStr;

      dbData.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "alert",
        message: `Alert Email #${checkout.alertsSent} sent to ${checkout.studentName} (${checkout.studentEmail}) regarding overdue "${checkout.componentName}". Subject: "${emailSubject || "Late reminder"}"`,
        schoolId
      });

      await writeDb(dbData);
      res.json({ success: true, checkout });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to log notice dispatch", details: err.message });
    }
  });

  // 9. Upload & Parse Bills / Receipts dynamically
  app.post("/api/components/upload-bill", async (req, res) => {
    try {
      const { billText } = req.body;
      if (!billText) {
        return res.status(400).json({ error: "Invoice/bill raw transcript or text content is required." });
      }

      const prompt = `You are a professional invoice and shipping receipt scanner in an engineering robotics laboratory.
Analyze the following invoice, order manifest, or sales receipt and extract the purchased items that are relevant as laboratory parts or parts storage equipment.

Invoice Transcript:
"""
${billText}
"""

Map each extracted component to one of these valid categories: "Microcontrollers", "Sensors", "Actuators", "Power Supplies", "Tools", or "Structural".
Logically estimate its storage drawer/cabinet location in a school laboratory (e.g. Cabinet A, Drawer B, Tool Shelf, Bin 5).
Provide a concise catalog name (e.g. "Adafruit Adafruit Feather ESP32") and a beautiful, informative educational description detailing how students can utilize it.
Assume condition is "Excellent".

Return your response strictly in valid JSON format matching this schema:
{
  "items": [
    {
      "name": "Component Name (clear and human-readable, e.g. HC-SR04 Ultrasonic Sensor)",
      "category": "One of: Microcontrollers, Sensors, Actuators, Power Supplies, Tools, Structural",
      "totalStock": (Integer quantity purchased),
      "location": "Suggested classroom storage location",
      "condition": "Excellent",
      "description": "Short description of what the item does and learning target"
    }
  ]
}`;

      try {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      category: { type: Type.STRING },
                      totalStock: { type: Type.INTEGER },
                      location: { type: Type.STRING },
                      condition: { type: Type.STRING },
                      description: { type: Type.STRING }
                    },
                    required: ["name", "category", "totalStock", "location", "condition", "description"]
                  }
                }
              },
              required: ["items"]
            }
          }
        });

        const outputText = response.text || "{\"items\":[]}";
        const parsed = JSON.parse(outputText);
        res.json({ success: true, items: parsed.items });
      } catch (aiErr: any) {
        console.warn("Gemini bill scan fallback active:", aiErr.message);

        // Advanced local regex/heuristic parser
        const lines = billText.split("\n");
        const detected: any[] = [];

        for (const line of lines) {
          const lower = line.toLowerCase();
          if (line.trim().length < 4 || lower.includes("subtotal") || lower.includes("total:") || lower.includes("tax")) {
            continue;
          }

          let quantity = 1;
          const qtyMatch = line.match(/(?:x\s*|qty:\s*|qty\s+)(\d+)/i) || line.match(/^(\d+)\s+x/i) || line.match(/\s+(\d+)\s*$/);
          if (qtyMatch) {
            quantity = parseInt(qtyMatch[1], 10) || 1;
          }

          const cleanLineName = line.replace(/(x\s*\d+|\d+\s*x|qty:\s*\d+)/gi, "").replace(/[$_#]/g, "").trim().substring(0, 40);

          if (lower.includes("arduino") || lower.includes("raspberry") || lower.includes("esp32") || lower.includes("microbit") || lower.includes("pico")) {
            detected.push({
              name: cleanLineName || "Arduino Uno R3 Microcontroller",
              category: "Microcontrollers",
              totalStock: quantity,
              location: "Cabinet A (Main Controller Rack)",
              condition: "Excellent",
              description: "Fast-prototyping hardware board extracted from recent invoice log."
            });
          } else if (lower.includes("sensor") || lower.includes("ultrasonic") || lower.includes("sonar") || lower.includes("gyro") || lower.includes("temperature") || lower.includes("ldr") || lower.includes("pir")) {
            detected.push({
              name: cleanLineName || "Ultrasonic Ranging Node",
              category: "Sensors",
              totalStock: quantity,
              location: "Cabinet B (Sensors Drawer)",
              condition: "Excellent",
              description: "Environmental transceiver feedback sensor added from electronic billing."
            });
          } else if (lower.includes("motor") || lower.includes("servo") || lower.includes("stepper") || lower.includes("sg90") || lower.includes("dc motor") || lower.includes("actuator")) {
            detected.push({
              name: cleanLineName || "SG90 Pro Micro Servo Actuator",
              category: "Actuators",
              totalStock: quantity,
              location: "Cabinet C (Actuators & Motors)",
              condition: "Excellent",
              description: "Rotational mechanical driver and micro motor gear."
            });
          } else if (lower.includes("battery") || lower.includes("charger") || lower.includes("power") || lower.includes("li-po") || lower.includes("power bank") || lower.includes("adapter")) {
            detected.push({
              name: cleanLineName || "Modular Power Battery Cell",
              category: "Power Supplies",
              totalStock: quantity,
              location: "Power Station (Safe Bin 1)",
              condition: "Excellent",
              description: "Current-limiting voltage regulator and battery supply cells."
            });
          } else if (lower.includes("soldering") || lower.includes("iron") || lower.includes("screwdriver") || lower.includes("stripper") || lower.includes("wrench") || lower.includes("tweezers")) {
            detected.push({
              name: cleanLineName || "Classroom Hand Assembly Tools",
              category: "Tools",
              totalStock: quantity,
              location: "Instructor Tool Bench Drawer",
              condition: "Excellent",
              description: "High-grade structural prototyping hand equipment."
            });
          } else if (lower.includes("bracket") || lower.includes("extrusion") || lower.includes("chassis") || lower.includes("screw") || lower.includes("chassis-kit") || lower.includes("beam")) {
            detected.push({
              name: cleanLineName || "Chassis Structural Beam Core",
              category: "Structural",
              totalStock: quantity,
              location: "Cabinet D (Structural Frame Units)",
              condition: "Excellent",
              description: "Framing chassis aluminum extrusion bracket unit."
            });
          }
        }

        // Catchall if nothing matched
        if (detected.length === 0) {
          detected.push({
            name: "Generic Robotics Auxiliary Module Pack",
            category: "Structural",
            totalStock: 5,
            location: "Cabinet D (General Warehouse Box 3)",
            condition: "Excellent",
            description: "Ancillary hardware nodes pulled from invoice transcription."
          });
        }

        res.json({ success: true, items: detected, isFallback: true });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Failed to scan invoice with assistant", details: err.message });
    }
  });

  // 10. Purchase Assistant e-commerce component search with Gemini Search Grounding
  app.post("/api/purchase-compare", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Procurement lookup query is required." });
      }

      const prompt = `You are an expert parts procurement specialist for high school and university engineering robotics clubs.
The user is looking to acquire: "${query}"

Find three or four legitimate, real-world educational or official distributors where this component typically is sold (e.g., SparkFun, Adafruit, DigiKey, Mouser, Amazon Business, RobotShop).
Compare them side-by-side with estimates for:
1. Current standard educational rate (in USD)
2. Normal delivery speed to US high schools
3. General real-time availability indicator ("In Stock", "Backordered", "Low Inventory")
4. Pros & Cons of purchasing from this specific seller (academic support, packaging quality, min order amounts)

Synthesize a helpful, professional purchasing recommendation tailored to class budget constraints.

Return your response strictly in valid JSON format matching this schema:
{
  "results": [
    {
      "vendor": "Name of Vendor (e.g. Adafruit Industries)",
      "price": "Standard rate or bulk package price",
      "shipping": "Estimated transit timeframe",
      "availability": "Stock tier description",
      "url": "Vendor homepage or general portal link",
      "pros": "Advantages of this vendor",
      "cons": "Disadvantages of this vendor"
    }
  ],
  "schoolRecommendation": "A short, elegant summary recommendation identifying who is the best choice (e.g. Adafruit for guides, DigiKey for bulk)."
}`;

      try {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                results: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      vendor: { type: Type.STRING },
                      price: { type: Type.STRING },
                      shipping: { type: Type.STRING },
                      availability: { type: Type.STRING },
                      url: { type: Type.STRING },
                      pros: { type: Type.STRING },
                      cons: { type: Type.STRING }
                    },
                    required: ["vendor", "price", "shipping", "availability", "url", "pros", "cons"]
                  }
                },
                schoolRecommendation: { type: Type.STRING }
              },
              required: ["results", "schoolRecommendation"]
            }
          }
        });

        const outputText = response.text || "{\"results\":[]}";
        const parsed = JSON.parse(outputText);
        res.json({ success: true, results: parsed.results, schoolRecommendation: parsed.schoolRecommendation });
      } catch (aiErr: any) {
        console.warn("Pricing comparison fallback active:", aiErr.message);

        // Smart database comparison fallback based on keywords
        const lowQuery = query.toLowerCase();
        let fallbackResults: any[] = [];
        let rec = "";

        if (lowQuery.includes("arduino") || lowQuery.includes("uno") || lowQuery.includes("microcontroller") || lowQuery.includes("esp32") || lowQuery.includes("pico")) {
          fallbackResults = [
            {
              vendor: "Adafruit Industries",
              price: "$27.60 (Official R3 Board)",
              shipping: "3-5 Business Days (Ground)",
              availability: "In Stock (100+)",
              url: "https://www.adafruit.com",
              pros: "100% genuine hardware; stellar educational slide-decks and class materials.",
              cons: "Flat rate shipping is slightly of high cost for small standalone boxes."
            },
            {
              vendor: "DigiKey Electronics",
              price: "$25.90 (Official R4 Minima)",
              shipping: "2-3 Days Saver Delivery",
              availability: "In Stock (5000+ units)",
              url: "https://www.digikey.com",
              pros: "Gigantic raw reserve volume; offers massive bulk discount rate for class size bundles.",
              cons: "Confusing engineering grid web panel for junior students."
            },
            {
              vendor: "Amazon Business Education",
              price: "$17.40 (Compatible generic board bundle)",
              shipping: "1-2 Days (Prime Express)",
              availability: "In Stock",
              url: "https://www.amazon.com",
              pros: "Significantly cheaper; immediate prime transit speed.",
              cons: "Slight build board variations; lacks academic guidance sheets."
            }
          ];
          rec = `For class cohorts, we highly recommend official Adafruit boards for safe beginner instruction due to their superb coding guides. If budget is extremely constrained, Amazon generic clones are a highly cost-efficient fallback.`;
        } else if (lowQuery.includes("sensor") || lowQuery.includes("ultrasonic") || lowQuery.includes("sonar") || lowQuery.includes("distance") || lowQuery.includes("gyro") || lowQuery.includes("imu")) {
          fallbackResults = [
            {
              vendor: "SparkFun Electronics",
              price: "$7.50 (HC-SR04 with STEMMA QT)",
              shipping: "3 Business Days (Standard)",
              availability: "In Stock",
              url: "https://www.sparkfun.com",
              pros: "Includes easy-solder modular connection heads, excellent junior hardware projects.",
              cons: "A few cents more expensive than pure industrial headers."
            },
            {
              vendor: "Adafruit Industries",
              price: "$6.95 (Raw HC-SR04 sensor node)",
              shipping: "3-5 Business Days (Ground)",
              availability: "Low Stock Warning (24 left)",
              url: "https://www.adafruit.com",
              pros: "Amazing step-by-step logic tutorials, code libraries ready.",
              cons: "Currently low on inventory."
            },
            {
              vendor: "DigiKey Electronics",
              price: "$4.80 (Bulk Industrial raw component)",
              shipping: "2 Days Saver Delivery",
              availability: "In Stock (10,000+)",
              url: "https://www.digikey.com",
              pros: "Cheapest raw pricing per unit, perfect for replacement stock packs.",
              cons: "Does not include easy jumper cables; pins require manual soldering."
            }
          ];
          rec = `SparkFun offers the best integrated plug-and-play sensor units (STEMMA/Qwiic) which saves valuable lecture time. For replacement parts in raw electronics containers, DigiKey fits school budgeting perfectly.`;
        } else {
          fallbackResults = [
            {
              vendor: "Adafruit Industries",
              price: "$14.95",
              shipping: "3-5 Business Days",
              availability: "In Stock",
              url: "https://www.adafruit.com",
              pros: "Top choice for educational guides, premium build materials.",
              cons: "Slightly higher shipping fees on individual items."
            },
            {
              vendor: "SparkFun Electronics",
              price: "$13.50",
              shipping: "3 Business Days (Ground)",
              availability: "In Stock",
              url: "https://www.sparkfun.com",
              pros: "High school student friendly kits, durable connector rails.",
              cons: "Bulk orders can take an extra day to process in depot."
            },
            {
              vendor: "Mouser Electronics Group",
              price: "$10.20 (Volume tier markdown)",
              shipping: "2 Days Saver Delivery",
              availability: "In Stock (2000+)",
              url: "https://www.mouser.com",
              pros: "Unbeatable wholesale bulk rates, original industrial warranties.",
              cons: "Complex technical part coding searches required."
            }
          ];
          rec = `For class kits, Adafruit or SparkFun provide the best academic experience. If you are conducting a massive replenishment of missing lab bins, Mouser has the best bulk rate.`;
        }

        res.json({
          success: true,
          results: fallbackResults,
          schoolRecommendation: rec,
          isFallback: true
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Failed to compare part vendors", details: err.message });
    }
  });

  // Load Vite development middlewares
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express robust server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical server boot error:", err);
});
