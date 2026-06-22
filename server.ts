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
}

interface LogEntry {
  id: string;
  timestamp: string;
  type: "checkout" | "return" | "alert" | "inventory" | "system";
  message: string;
}

interface DBStructure {
  components: Component[];
  checkouts: Checkout[];
  logs: LogEntry[];
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
      }]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(seedData, null, 2), "utf-8");
  }
}

async function readDb(): Promise<DBStructure> {
  ensureDb();
  const raw = await fs.promises.readFile(DB_FILE, "utf-8");
  const data = JSON.parse(raw) as DBStructure;
  
  // Dynamic overdue updates based on current date
  const todayStr = new Date().toISOString().split("T")[0];
  let changed = false;
  
  data.checkouts = data.checkouts.map(chk => {
    if (chk.returnedDate === null && chk.dueDate < todayStr && chk.status !== "overdue") {
      chk.status = "overdue";
      changed = true;
      
      // Auto register a system log for overdue items
      data.logs.unshift({
        id: `auto-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        type: "system",
        message: `System flagged checkout of "${chk.componentName}" for ${chk.studentName} as OUTSTANDING/OVERDUE.`
      });
    }
    return chk;
  });

  if (changed) {
    await fs.promises.writeFile(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  }
  
  return data;
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

  // API Routes
  
  // 1. Get all data
  app.get("/api/data", async (req, res) => {
    try {
      const dbData = await readDb();
      res.json(dbData);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to read database state", details: err.message });
    }
  });

  // 2. Add structural component to inventory
  app.post("/api/components", async (req, res) => {
    try {
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
        description: description || ""
      };

      dbData.components.push(newComp);
      dbData.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "inventory",
        message: `Added new component "${name}" with initial stock of ${totalStock} to ${newComp.location}.`
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
      const compId = req.params.id;
      const { name, category, totalStock, location, condition, description } = req.body;
      const dbData = await readDb();

      const index = dbData.components.findIndex(c => c.id === compId);
      if (index === -1) {
        return res.status(404).json({ error: "Component not found." });
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
        message: `Updated component properties for "${updatedComp.name}". New Total Stock: ${updatedComp.totalStock}, Available: ${updatedComp.availableStock}.`
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
      const compId = req.params.id;
      const dbData = await readDb();

      const index = dbData.components.findIndex(c => c.id === compId);
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
        message: `Removed component "${compName}" from lab inventory tracker.`
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
      const { componentId, studentName, studentEmail, quantity, dueDate } = req.body;
      if (!componentId || !studentName || !studentEmail || typeof quantity !== "number" || quantity <= 0 || !dueDate) {
        return res.status(400).json({ error: "Invalid checkout request schema." });
      }

      const dbData = await readDb();
      const compIndex = dbData.components.findIndex(c => c.id === componentId);
      if (compIndex === -1) {
        return res.status(404).json({ error: "Target component does not exist." });
      }

      const component = dbData.components[compIndex];
      if (component.availableStock < quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock. Requested: ${quantity}, Available: ${component.availableStock}.` 
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
        studentName,
        studentEmail,
        quantity,
        checkoutDate: todayStr,
        dueDate,
        returnedDate: null,
        status,
        alertsSent: 0,
        lastAlertDate: null
      };

      dbData.checkouts.unshift(newCheckout);
      dbData.logs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "checkout",
        message: `${studentName} (${studentEmail}) checked out ${quantity}x "${component.name}". Due Date: ${dueDate}.`
      });

      await writeDb(dbData);
      res.status(201).json(newCheckout);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to checkout component", details: err.message });
    }
  });

  // 6. Return Component
  app.post("/api/checkouts/:id/return", async (req, res) => {
    try {
      const checkoutId = req.params.id;
      const dbData = await readDb();

      const chkIndex = dbData.checkouts.findIndex(c => c.id === checkoutId);
      if (chkIndex === -1) {
        return res.status(404).json({ error: "Checkout log entry not found." });
      }

      const checkout = dbData.checkouts[chkIndex];
      if (checkout.returnedDate !== null) {
        return res.status(400).json({ error: "Component has already been recorded as returned." });
      }

      const compIndex = dbData.components.findIndex(c => c.id === checkout.componentId);
      if (compIndex !== -1) {
        dbData.components[compIndex].availableStock += checkout.quantity;
        // Correct overflow bounds just in case of adjustments
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
        message: `${checkout.studentName} returned ${checkout.quantity}x "${checkout.componentName}" successfully.`
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
      const { checkoutId, tone } = req.body;
      if (!checkoutId || !tone) {
        return res.status(400).json({ error: "checkoutId and tone are required." });
      }

      const dbData = await readDb();
      const checkout = dbData.checkouts.find(c => c.id === checkoutId);
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

        const prompt = `You are the Lead Robotics Engineering Instructor and Lab Coordinator at Lincoln High School. 
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
          fallbackBody = `To the Parent/Guardian of ${checkout.studentName},\n\nWe are writing to coordinate the return of school robotics equipment checked out by ${checkout.studentName} for class laboratory activities. The item, ${checkout.quantity}x ${checkout.componentName}, is now ${daysOverdue} days overdue and must be accounted for.\n\nPlease discuss returning this component tomorrow model-build session so we can avoid replacement material logs.\n\nSincerely,\nRobotics Lab Administration\nLincoln High School`;
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
      const checkoutId = req.params.id;
      const { emailSubject, emailBody } = req.body;
      const dbData = await readDb();

      const chkIndex = dbData.checkouts.findIndex(c => c.id === checkoutId);
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
        message: `Alert Email #${checkout.alertsSent} sent to ${checkout.studentName} (${checkout.studentEmail}) regarding overdue "${checkout.componentName}". Subject: "${emailSubject || "Late reminder"}"`
      });

      await writeDb(dbData);
      res.json({ success: true, checkout });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to log notice dispatch", details: err.message });
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
