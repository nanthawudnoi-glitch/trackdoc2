import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from 'url';
import fs from "fs";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("procurement.db");
const upload = multer({ dest: "uploads/" });

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_code TEXT,
    title TEXT NOT NULL,
    department TEXT,
    budget_amount REAL,
    budget_source TEXT,
    current_process TEXT DEFAULT 'A',
    current_step INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    creator_name TEXT,
    creator_position TEXT,
    creator_id TEXT,
    project_nature TEXT,
    material_usage_date TEXT,
    allocated_budget REAL,
    procured_amount REAL,
    dept_head_name TEXT,
    dept_head_position TEXT,
    deputy_name TEXT,
    deputy_position TEXT,
    necessity_reason TEXT,
    in_plan TEXT,
    request_amount REAL,
    remaining_budget REAL,
    expense_category TEXT,
    delivery_dates TEXT,
    committee_chairman TEXT,
    committee_member1 TEXT,
    committee_member2 TEXT,
    is_loan INTEGER DEFAULT 0,
    borrower_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    process TEXT,
    step INTEGER,
    action TEXT,
    actor TEXT,
    notes TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS budget_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS project_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    description TEXT NOT NULL,
    unit TEXT,
    quantity REAL,
    unit_price REAL,
    total_price REAL,
    shop_name TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    tax_id TEXT,
    bank_account TEXT,
    bank_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS approver_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position_key TEXT UNIQUE,
    position_name TEXT NOT NULL,
    person_name TEXT,
    person_position TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add missing columns if they don't exist
const tableInfo = db.prepare("PRAGMA table_info(projects)").all() as any[];
const columnNames = tableInfo.map(info => info.name);

if (!columnNames.includes('updated_at')) {
  db.exec("ALTER TABLE projects ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
  // For existing rows, set updated_at to created_at
  db.exec("UPDATE projects SET updated_at = created_at WHERE updated_at IS NULL");
}

if (!columnNames.includes('budget_source')) {
  db.exec("ALTER TABLE projects ADD COLUMN budget_source TEXT");
}

// Seed initial budget sources if empty
const budgetSourceCount = db.prepare("SELECT COUNT(*) as count FROM budget_sources").get() as any;
if (budgetSourceCount.count === 0) {
  const insertSource = db.prepare("INSERT INTO budget_sources (name) VALUES (?)");
  insertSource.run('งบประมาณแผ่นดิน');
  insertSource.run('เงินรายได้สถานศึกษา');
  insertSource.run('งบอุดหนุน');
}

// Seed initial expense categories if empty
const expenseCategoryCount = db.prepare("SELECT COUNT(*) as count FROM expense_categories").get() as any;
if (expenseCategoryCount.count === 0) {
  const insertCat = db.prepare("INSERT INTO expense_categories (name) VALUES (?)");
  insertCat.run('งบ.ปวช.');
  insertCat.run('งบ.ปวส.');
  insertCat.run('งบ.ระยะสั้น');
  insertCat.run('ค่าจัดการเรียนการสอน');
  insertCat.run('บกศ.');
  insertCat.run('งบประมาณอื่น');
}

// Seed initial approver settings if empty
const approverCount = db.prepare("SELECT COUNT(*) as count FROM approver_settings").get() as any;
if (approverCount.count === 0) {
  const insertApprover = db.prepare("INSERT INTO approver_settings (position_key, position_name, person_name, person_position) VALUES (?, ?, ?, ?)");
  insertApprover.run('PROCUREMENT_HEAD', 'หัวหน้างานพัสดุ', '', '');
  insertApprover.run('PLANNING_HEAD', 'หัวหน้างานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ', '', '');
  insertApprover.run('FINANCE_HEAD', 'หัวหน้างานการเงิน', '', '');
  insertApprover.run('DEPUTY_PLANNING', 'รองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน', '', '');
  insertApprover.run('DEPUTY_RESOURCES', 'รองผู้อำนวยการฝ่ายบริหารทรัพยากร', '', '');
  insertApprover.run('DIRECTOR', 'ผู้อำนวยการ', '', '');
}

// Seed initial users
const insertUser = db.prepare("INSERT OR IGNORE INTO users (username, password, role, name, position) VALUES (?, ?, ?, ?, ?)");
insertUser.run('admin', 'admin123', 'ADMIN', 'ผู้ดูแลระบบ', 'ผู้ดูแลระบบ');
insertUser.run('plan_staff', 'password', 'PLANNING_STAFF', 'เจ้าหน้าที่งานวางแผน', 'เจ้าหน้าที่งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ');
insertUser.run('plan_head', 'password', 'PLANNING_HEAD', 'หัวหน้างานวางแผน', 'หัวหน้างานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ');
insertUser.run('proc_staff', 'password', 'PROCUREMENT_STAFF', 'เจ้าหน้าที่งานพัสดุ', 'เจ้าหน้าที่งานพัสดุ');
insertUser.run('proc_head', 'password', 'PROCUREMENT_HEAD', 'หัวหน้างานพัสดุ', 'หัวหน้างานพัสดุ');
insertUser.run('fin_staff', 'password', 'FINANCE_STAFF', 'เจ้าหน้าที่งานการเงิน', 'เจ้าหน้าที่งานการเงิน');
insertUser.run('fin_head', 'password', 'FINANCE_HEAD', 'หัวหน้างานการเงิน', 'หัวหน้างานการเงิน');
insertUser.run('deputy_plan', 'password', 'DEPUTY_DIRECTOR_PLANNING', 'รองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน', 'รองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน');
insertUser.run('deputy_res', 'password', 'DEPUTY_DIRECTOR_RESOURCES', 'รองผู้อำนวยการฝ่ายบริหารทรัพยากร', 'รองผู้อำนวยการฝ่ายบริหารทรัพยากร');
insertUser.run('director', 'password', 'DIRECTOR', 'ผู้อำนวยการ', 'ผู้อำนวยการวิทยาลัย');
insertUser.run('staff', 'password', 'STAFF', 'บุคลากร', 'บุคลากร');
insertUser.run('guest', 'password', 'GUEST', 'ผู้เข้าชมทั่วไป', 'ผู้เข้าชมทั่วไป');

// Migration: Add columns if they don't exist
try { db.exec("ALTER TABLE projects ADD COLUMN project_code TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN creator_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN creator_position TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN creator_id TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN project_nature TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN material_usage_date TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN allocated_budget REAL"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN procured_amount REAL"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN dept_head_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN dept_head_position TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN deputy_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN deputy_position TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN necessity_reason TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN in_plan TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN request_amount REAL"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN remaining_budget REAL"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN expense_category TEXT"); } catch (e) {}
if (!columnNames.includes('delivery_dates')) {
  db.exec("ALTER TABLE projects ADD COLUMN delivery_dates TEXT");
}

try { db.exec("ALTER TABLE projects ADD COLUMN committee_chairman TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN committee_member1 TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN committee_member2 TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN is_loan INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN borrower_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN loan_expense_category TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE project_items ADD COLUMN shop_name TEXT"); } catch (e) {}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/projects", (req, res) => {
    try {
      const projects = db.prepare(`
        SELECT p.*, 
        (SELECT GROUP_CONCAT(DISTINCT shop_name) FROM project_items WHERE project_id = p.id AND shop_name IS NOT NULL AND shop_name != '') as item_shops
        FROM projects p 
        ORDER BY updated_at DESC
      `).all();
      res.json(projects);
    } catch (err) {
      console.error("Error fetching projects:", err);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", (req, res) => {
    try {
      const project = db.prepare(`
        SELECT p.*, 
        (SELECT GROUP_CONCAT(DISTINCT shop_name) FROM project_items WHERE project_id = p.id AND shop_name IS NOT NULL AND shop_name != '') as item_shops
        FROM projects p 
        WHERE p.id = ?
      `).get(req.params.id) as any;
      if (!project) return res.status(404).json({ error: "Project not found" });
      const logs = db.prepare("SELECT * FROM project_logs WHERE project_id = ? ORDER BY timestamp DESC").all(req.params.id);
      const items = db.prepare("SELECT * FROM project_items WHERE project_id = ?").all(req.params.id);
      res.json({ ...project, logs, items });
    } catch (err) {
      console.error(`Error fetching project ${req.params.id}:`, err);
      res.status(500).json({ error: "Failed to fetch project details" });
    }
  });

  app.post("/api/projects", (req, res) => {
    try {
      const { 
        project_code, title, department, budget_amount, budget_source, 
        creator_name, creator_position, creator_id, 
        project_nature, necessity_reason, material_usage_date, allocated_budget, procured_amount,
        dept_head_name, dept_head_position, deputy_name, deputy_position,
        committee_chairman, committee_member1, committee_member2,
        is_loan, borrower_name,
        items 
      } = req.body;
      const info = db.prepare(`
        INSERT INTO projects (
          project_code, title, department, budget_amount, budget_source, 
          creator_name, creator_position, creator_id,
          project_nature, necessity_reason, material_usage_date, allocated_budget, procured_amount,
          dept_head_name, dept_head_position, deputy_name, deputy_position,
          committee_chairman, committee_member1, committee_member2,
          is_loan, borrower_name
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        project_code || null, title, department, budget_amount, budget_source, 
        creator_name || null, creator_position || null, creator_id || null,
        project_nature || null, necessity_reason || null, material_usage_date || null, allocated_budget || 0, procured_amount || 0,
        dept_head_name || null, dept_head_position || null, deputy_name || null, deputy_position || null,
        committee_chairman || null, committee_member1 || null, committee_member2 || null,
        is_loan ? 1 : 0, borrower_name || null
      );
      
      const projectId = info.lastInsertRowid;

      if (items && Array.isArray(items)) {
        const insertItem = db.prepare(`
          INSERT INTO project_items (project_id, description, unit, quantity, unit_price, total_price, shop_name)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of items) {
          insertItem.run(projectId, item.description, item.unit, item.quantity, item.unit_price, item.total_price, item.shop_name || null);
        }
      }

      db.prepare(`
        INSERT INTO project_logs (project_id, process, step, action, actor)
        VALUES (?, 'A', 1, 'สร้างโครงการ', ?)
      `).run(projectId, creator_name || 'ผู้ดำเนินการ');

      res.json({ id: projectId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id/step", (req, res) => {
    try {
      const { 
        process, step, actor, notes, status, items,
        in_plan, request_amount, remaining_budget, expense_category, allocated_budget,
        delivery_dates, borrower_name, loan_expense_category
      } = req.body;
      const projectId = req.params.id;
      
      const transaction = db.transaction(() => {
        if (status) {
          db.prepare(`
            UPDATE projects 
            SET current_process = ?, current_step = ?, status = ?, 
                in_plan = COALESCE(?, in_plan),
                request_amount = COALESCE(?, request_amount),
                remaining_budget = COALESCE(?, remaining_budget),
                expense_category = COALESCE(?, expense_category),
                allocated_budget = COALESCE(?, allocated_budget),
                budget_amount = COALESCE(?, budget_amount),
                delivery_dates = COALESCE(?, delivery_dates),
                borrower_name = COALESCE(?, borrower_name),
                loan_expense_category = COALESCE(?, loan_expense_category),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            process ?? null, 
            step ?? null, 
            status ?? null, 
            in_plan ?? null, 
            request_amount ?? null, 
            remaining_budget ?? null, 
            expense_category ?? null, 
            allocated_budget ?? null, 
            request_amount ?? null, 
            delivery_dates ?? null,
            borrower_name ?? null,
            loan_expense_category ?? null,
            projectId
          );
        } else {
          db.prepare(`
            UPDATE projects 
            SET current_process = ?, current_step = ?, 
                in_plan = COALESCE(?, in_plan),
                request_amount = COALESCE(?, request_amount),
                remaining_budget = COALESCE(?, remaining_budget),
                expense_category = COALESCE(?, expense_category),
                allocated_budget = COALESCE(?, allocated_budget),
                budget_amount = COALESCE(?, budget_amount),
                delivery_dates = COALESCE(?, delivery_dates),
                borrower_name = COALESCE(?, borrower_name),
                loan_expense_category = COALESCE(?, loan_expense_category),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            process ?? null, 
            step ?? null, 
            in_plan ?? null, 
            request_amount ?? null, 
            remaining_budget ?? null, 
            expense_category ?? null, 
            allocated_budget ?? null, 
            request_amount ?? null, 
            delivery_dates ?? null,
            borrower_name ?? null,
            loan_expense_category ?? null,
            projectId
          );
        }

        if (items && Array.isArray(items)) {
          const updateItemShop = db.prepare(`
            UPDATE project_items 
            SET shop_name = ? 
            WHERE id = ? AND project_id = ?
          `);
          for (const item of items) {
            updateItemShop.run(item.shop_name, item.id, projectId);
          }
        }

        db.prepare(`
          INSERT INTO project_logs (project_id, process, step, action, actor, notes)
          VALUES (?, ?, ?, 'อัปเดตสถานะ', ?, ?)
        `).run(projectId, process, step, actor, notes);
      });

      transaction();
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  app.put("/api/projects/:id", (req, res) => {
    try {
      const { 
        project_code, title, department, budget_amount, budget_source, 
        project_nature, necessity_reason, material_usage_date, allocated_budget, procured_amount,
        dept_head_name, dept_head_position, deputy_name, deputy_position,
        in_plan, request_amount, remaining_budget, expense_category,
        committee_chairman, committee_member1, committee_member2,
        is_loan, borrower_name,
        items 
      } = req.body;
      const projectId = req.params.id;

      db.prepare(`
        UPDATE projects 
        SET project_code = ?, title = ?, department = ?, budget_amount = ?, budget_source = ?, 
            project_nature = ?, necessity_reason = ?, material_usage_date = ?, allocated_budget = ?, procured_amount = ?,
            dept_head_name = ?, dept_head_position = ?, deputy_name = ?, deputy_position = ?,
            in_plan = ?, request_amount = ?, remaining_budget = ?, expense_category = ?,
            committee_chairman = ?, committee_member1 = ?, committee_member2 = ?,
            is_loan = ?, borrower_name = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        project_code || null, title, department, budget_amount, budget_source, 
        project_nature || null, necessity_reason || null, material_usage_date || null, allocated_budget || 0, procured_amount || 0,
        dept_head_name || null, dept_head_position || null, deputy_name || null, deputy_position || null,
        in_plan || null, request_amount || 0, remaining_budget || 0, expense_category || null,
        committee_chairman || null, committee_member1 || null, committee_member2 || null,
        is_loan ? 1 : 0, borrower_name || null,
        projectId
      );

      // Update items: Delete existing and insert new ones
      db.prepare("DELETE FROM project_items WHERE project_id = ?").run(projectId);

      if (items && Array.isArray(items)) {
        const insertItem = db.prepare(`
          INSERT INTO project_items (project_id, description, unit, quantity, unit_price, total_price, shop_name)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of items) {
          insertItem.run(projectId, item.description, item.unit, item.quantity, item.unit_price, item.total_price, item.shop_name || null);
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.post("/api/projects/bulk-step", (req, res) => {
    const { updates } = req.body; // Array of { id, process, step, actor, notes, status }
    
    const updateProject = db.prepare(`
      UPDATE projects 
      SET current_process = ?, current_step = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const insertLog = db.prepare(`
      INSERT INTO project_logs (project_id, process, step, action, actor, notes)
      VALUES (?, ?, ?, 'อัปเดตสถานะ (Bulk)', ?, ?)
    `);

    const transaction = db.transaction((items) => {
      for (const item of items) {
        updateProject.run(item.process, item.step, item.status || 'pending', item.id);
        insertLog.run(item.id, item.process, item.step, item.actor, item.notes);
      }
    });

    try {
      transaction(updates);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to perform bulk update" });
    }
  });

  app.get("/api/stats", (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      let dateFilter = "";
      const params: any[] = [];

      if (startDate && endDate) {
        dateFilter = "AND p.updated_at >= ? AND p.updated_at <= ?";
        params.push(startDate + " 00:00:00", endDate + " 23:59:59");
      }

      // Total paid amount by day (for completed projects)
      const dailyPayments = db.prepare(`
        SELECT date(p.updated_at) as date, SUM(p.budget_amount) as total
        FROM projects p
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) ${dateFilter}
        GROUP BY date(p.updated_at)
        ORDER BY date
      `).all(...params);

      // Total paid amount by month
      const monthlyPayments = db.prepare(`
        SELECT strftime('%Y-%m', p.updated_at) as month, SUM(p.budget_amount) as total
        FROM projects p
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) ${dateFilter}
        GROUP BY strftime('%Y-%m', p.updated_at)
        ORDER BY month
      `).all(...params);

      // Total paid amount by year
      const yearlyPayments = db.prepare(`
        SELECT strftime('%Y', p.updated_at) as year, SUM(p.budget_amount) as total
        FROM projects p
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) ${dateFilter}
        GROUP BY strftime('%Y', p.updated_at)
        ORDER BY year
      `).all(...params);

      // Projects pending by process
      const pendingByProcess = db.prepare(`
        SELECT current_process, COUNT(*) as count
        FROM projects
        WHERE status != 'completed' AND NOT (is_loan = 1 AND current_process = 'D' AND current_step = 26)
        GROUP BY current_process
      `).all();

      // Total projects by status
      const statusCounts = db.prepare(`
        SELECT 
          CASE 
            WHEN status = 'completed' OR (is_loan = 1 AND current_process = 'D' AND current_step = 26) THEN 'completed'
            ELSE status 
          END as status, 
          COUNT(*) as count
        FROM projects
        GROUP BY 
          CASE 
            WHEN status = 'completed' OR (is_loan = 1 AND current_process = 'D' AND current_step = 26) THEN 'completed'
            ELSE status 
          END
      `).all();

      // Budget source payments summary
      const budgetSourcePayments = db.prepare(`
        SELECT p.budget_source, SUM(p.budget_amount) as total_amount, COUNT(*) as project_count
        FROM projects p
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) ${dateFilter}
        GROUP BY p.budget_source
        ORDER BY total_amount DESC
      `).all(...params);

      // Shop payments summary - Calculate from project_items total_price
      const shopPayments = db.prepare(`
        SELECT pi.shop_name, SUM(pi.total_price) as total_amount, COUNT(DISTINCT pi.project_id) as project_count
        FROM project_items pi
        JOIN projects p ON pi.project_id = p.id
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) AND pi.shop_name IS NOT NULL AND pi.shop_name != '' ${dateFilter}
        GROUP BY pi.shop_name
        ORDER BY total_amount DESC
      `).all(...params);

      // Department payments summary
      const departmentPayments = db.prepare(`
        SELECT p.department, SUM(p.budget_amount) as total_amount, COUNT(*) as project_count
        FROM projects p
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) ${dateFilter}
        GROUP BY p.department
        ORDER BY total_amount DESC
      `).all(...params);

      // Loan projects summary by department
      const loanDepartmentPayments = db.prepare(`
        SELECT p.department, 
               SUM(p.budget_amount) as total_amount, 
               COUNT(*) as project_count,
               SUM(CASE WHEN (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) THEN p.budget_amount ELSE 0 END) as completed_amount,
               COUNT(CASE WHEN (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) THEN 1 END) as completed_count
        FROM projects p
        WHERE p.is_loan = 1 ${dateFilter}
        GROUP BY p.department
        ORDER BY total_amount DESC
      `).all(...params);

      res.json({
        dailyPayments,
        monthlyPayments,
        yearlyPayments,
        pendingByProcess,
        statusCounts,
        shopPayments,
        budgetSourcePayments,
        departmentPayments,
        loanDepartmentPayments
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/stats/pending/:process", (req, res) => {
    try {
      const { process } = req.params;
      const projects = db.prepare(`
        SELECT * FROM projects 
        WHERE current_process = ? AND status != 'completed'
        ORDER BY updated_at DESC
      `).all(process);
      res.json(projects);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch pending projects" });
    }
  });

  app.get("/api/stats/shop/:shopName", (req, res) => {
    try {
      const { shopName } = req.params;
      const { startDate, endDate } = req.query;
      let dateFilter = "";
      const params: any[] = [shopName];

      if (startDate && endDate) {
        dateFilter = "AND p.updated_at >= ? AND p.updated_at <= ?";
        params.push(startDate + " 00:00:00", endDate + " 23:59:59");
      }

      const projects = db.prepare(`
        SELECT DISTINCT p.* FROM projects p
        JOIN project_items pi ON p.id = pi.project_id
        WHERE pi.shop_name = ? AND (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) ${dateFilter}
        ORDER BY p.updated_at DESC
      `).all(...params);
      res.json(projects);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch shop projects" });
    }
  });

  app.get("/api/stats/department/:department", (req, res) => {
    try {
      const { department } = req.params;
      const { startDate, endDate } = req.query;
      let dateFilter = "";
      const params: any[] = [department];

      if (startDate && endDate) {
        dateFilter = "AND p.updated_at >= ? AND p.updated_at <= ?";
        params.push(startDate + " 00:00:00", endDate + " 23:59:59");
      }

      const projects = db.prepare(`
        SELECT * FROM projects p
        WHERE p.department = ? AND (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) ${dateFilter}
        ORDER BY p.updated_at DESC
      `).all(...params);
      res.json(projects);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch department projects" });
    }
  });

  app.get("/api/stats/items/search", (req, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.json([]);
      
      const items = db.prepare(`
        SELECT pi.description, pi.unit, SUM(pi.quantity) as total_quantity, SUM(pi.quantity * pi.unit_price) as total_amount, COUNT(DISTINCT p.id) as project_count
        FROM project_items pi
        JOIN projects p ON pi.project_id = p.id
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) AND pi.description LIKE ?
        GROUP BY pi.description, pi.unit
        ORDER BY total_quantity DESC
      `).all(`%${q}%`);
      
      res.json(items);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to search items" });
    }
  });

  app.get("/api/stats/items/details", (req, res) => {
    try {
      const { description } = req.query;
      if (!description) return res.json([]);
      
      const details = db.prepare(`
        SELECT p.id, p.title, p.project_code, p.department, p.updated_at, pi.quantity, pi.unit, pi.unit_price, (pi.quantity * pi.unit_price) as total_price, pi.shop_name
        FROM project_items pi
        JOIN projects p ON pi.project_id = p.id
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) AND pi.description = ?
        ORDER BY p.updated_at DESC
      `).all(description);
      
      res.json(details);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch item details" });
    }
  });

  // User Routes
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password) as any;
    if (user) {
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ error: "Invalid username or password" });
    }
  });

  app.get("/api/users", (req, res) => {
    try {
      const users = db.prepare("SELECT username, role, name, position FROM users").all();
      res.json(users);
    } catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch("/api/users/:username/password", (req, res) => {
    const { password } = req.body;
    try {
      db.prepare("UPDATE users SET password = ? WHERE username = ?").run(password, req.params.username);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update password" });
    }
  });

  app.post("/api/users", (req, res) => {
    const { username, password, role, name, position } = req.body;
    try {
      db.prepare("INSERT INTO users (username, password, role, name, position) VALUES (?, ?, ?, ?, ?)")
        .run(username, password, role, name, position);
      res.json({ success: true });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: "Failed to create user" });
      }
    }
  });

  app.patch("/api/users/:username", (req, res) => {
    const { role, name, position, password } = req.body;
    try {
      if (password) {
        db.prepare("UPDATE users SET role = ?, name = ?, position = ?, password = ? WHERE username = ?")
          .run(role, name, position, password, req.params.username);
      } else {
        db.prepare("UPDATE users SET role = ?, name = ?, position = ? WHERE username = ?")
          .run(role, name, position, req.params.username);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:username", (req, res) => {
    try {
      db.prepare("DELETE FROM users WHERE username = ?").run(req.params.username);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Vendors API
  app.get("/api/vendors", (req, res) => {
    try {
      const vendors = db.prepare("SELECT * FROM vendors ORDER BY name ASC").all();
      res.json(vendors);
    } catch (err) {
      console.error("Error fetching vendors:", err);
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  app.post("/api/vendors", (req, res) => {
    const { name, address, phone, tax_id, bank_account, bank_name } = req.body;
    try {
      const info = db.prepare(`
        INSERT INTO vendors (name, address, phone, tax_id, bank_account, bank_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(name, address, phone, tax_id, bank_account, bank_name);
      res.json({ id: info.lastInsertRowid, success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create vendor" });
    }
  });

  app.put("/api/vendors/:id", (req, res) => {
    const { name, address, phone, tax_id, bank_account, bank_name } = req.body;
    try {
      db.prepare(`
        UPDATE vendors 
        SET name = ?, address = ?, phone = ?, tax_id = ?, bank_account = ?, bank_name = ?
        WHERE id = ?
      `).run(name, address, phone, tax_id, bank_account, bank_name, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update vendor" });
    }
  });

  app.delete("/api/vendors/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM vendors WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete vendor" });
    }
  });

  // Approver Settings API
  app.get("/api/approvers", (req, res) => {
    const approvers = db.prepare("SELECT * FROM approver_settings ORDER BY id ASC").all();
    res.json(approvers);
  });

  app.put("/api/approvers/:id", (req, res) => {
    const { person_name, person_position } = req.body;
    try {
      db.prepare(`
        UPDATE approver_settings 
        SET person_name = ?, person_position = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(person_name, person_position, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update approver" });
    }
  });

  // Backup & Restore Routes
  app.get("/api/admin/backup", (req, res) => {
    try {
      const dbPath = path.join(process.cwd(), "procurement.db");
      const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
      res.download(dbPath, filename);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Backup failed" });
    }
  });

  app.post("/api/admin/restore", upload.single("database"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    const tempPath = req.file.path;
    const targetPath = path.join(process.cwd(), "procurement.db");
    
    try {
      // Close current DB connection
      db.close();
      
      // Overwrite DB file
      fs.copyFileSync(tempPath, targetPath);
      
      // Cleanup temp file
      fs.unlinkSync(tempPath);
      
      // We don't reopen here because we'll exit and let the platform restart the container
      // This ensures a clean state with the new DB
      res.json({ message: "Database restored successfully. System is restarting..." });
      
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Restore failed" });
    }
  });

  app.post("/api/users/sync", (req, res) => {
    try {
      const insertUser = db.prepare("INSERT OR IGNORE INTO users (username, password, role, name, position) VALUES (?, ?, ?, ?, ?)");
      insertUser.run('admin', 'admin123', 'ADMIN', 'ผู้ดูแลระบบ', 'ผู้ดูแลระบบ');
      insertUser.run('plan_staff', 'password', 'PLANNING_STAFF', 'เจ้าหน้าที่งานวางแผน', 'เจ้าหน้าที่งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ');
      insertUser.run('plan_head', 'password', 'PLANNING_HEAD', 'หัวหน้างานวางแผน', 'หัวหน้างานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ');
      insertUser.run('proc_staff', 'password', 'PROCUREMENT_STAFF', 'เจ้าหน้าที่งานพัสดุ', 'เจ้าหน้าที่งานพัสดุ');
      insertUser.run('proc_head', 'password', 'PROCUREMENT_HEAD', 'หัวหน้างานพัสดุ', 'หัวหน้างานพัสดุ');
      insertUser.run('fin_staff', 'password', 'FINANCE_STAFF', 'เจ้าหน้าที่งานการเงิน', 'เจ้าหน้าที่งานการเงิน');
      insertUser.run('fin_head', 'password', 'FINANCE_HEAD', 'หัวหน้างานการเงิน', 'หัวหน้างานการเงิน');
      insertUser.run('deputy_plan', 'password', 'DEPUTY_DIRECTOR_PLANNING', 'รองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน', 'รองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน');
      insertUser.run('deputy_res', 'password', 'DEPUTY_DIRECTOR_RESOURCES', 'รองผู้อำนวยการฝ่ายบริหารทรัพยากร', 'รองผู้อำนวยการฝ่ายบริหารทรัพยากร');
      insertUser.run('director', 'password', 'DIRECTOR', 'ผู้อำนวยการ', 'ผู้อำนวยการวิทยาลัย');
      insertUser.run('staff', 'password', 'STAFF', 'บุคลากร', 'บุคลากร');
      insertUser.run('guest', 'password', 'GUEST', 'ผู้เข้าชมทั่วไป', 'ผู้เข้าชมทั่วไป');
      res.json({ success: true, message: "User accounts synchronized successfully" });
    } catch (err) {
      res.status(500).json({ error: "Failed to sync users" });
    }
  });

  app.post("/api/users/bulk", (req, res) => {
    const { users: bulkUsers } = req.body;
    if (!Array.isArray(bulkUsers)) {
      return res.status(400).json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" });
    }

    try {
      const checkUser = db.prepare("SELECT username FROM users WHERE username = ?");
      const insertUser = db.prepare("INSERT INTO users (username, password, role, name, position) VALUES (?, ?, ?, ?, ?)");
      
      const transaction = db.transaction((users) => {
        let added = 0;
        let skipped = 0;
        let total = 0;

        for (const u of users) {
          if (!u.username) continue;
          total++;
          
          const username = String(u.username).trim();
          const existing = checkUser.get(username);
          
          if (existing) {
            skipped++;
            continue;
          }

          const role = u.role || 'STAFF';
          insertUser.run(
            username, 
            String(u.password || '123456').trim(), 
            role.trim().toUpperCase(), 
            String(u.name || u.username).trim(), 
            String(u.position || 'บุคลากร').trim()
          );
          added++;
        }
        return { total, added, skipped };
      });

      const stats = transaction(bulkUsers);
      res.json({ 
        success: true, 
        message: `นำเข้าข้อมูลเสร็จสิ้น: เพิ่มใหม่ ${stats.added} รายการ, ข้าม ${stats.skipped} รายการ (มีในระบบแล้ว), รวมทั้งสิ้น ${stats.total} รายการ`,
        stats
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Bulk import failed" });
    }
  });

  app.delete("/api/projects/:id", (req, res) => {
    const projectId = req.params.id;
    console.log(`[DELETE] Request received for project ID: ${projectId}`);
    try {
      const transaction = db.transaction((id) => {
        console.log(`[DELETE] Deleting items for project ${id}`);
        db.prepare("DELETE FROM project_items WHERE project_id = ?").run(id);
        console.log(`[DELETE] Deleting logs for project ${id}`);
        db.prepare("DELETE FROM project_logs WHERE project_id = ?").run(id);
        console.log(`[DELETE] Deleting project ${id}`);
        const info = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
        console.log(`[DELETE] Project deleted. Rows affected: ${info.changes}`);
        return info.changes;
      });
      const changes = transaction(projectId);
      if (changes === 0) {
        console.warn(`[DELETE] No project found with ID: ${projectId}`);
      }
      res.json({ success: true, deleted: changes > 0 });
    } catch (err) {
      console.error(`[DELETE] Error deleting project ${projectId}:`, err);
      res.status(500).json({ error: "Failed to delete project", details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.patch("/api/projects/:id", (req, res) => {
    try {
      const { 
        project_code, title, department, budget_amount, budget_source,
        project_nature, necessity_reason, material_usage_date, allocated_budget, procured_amount,
        dept_head_name, dept_head_position, deputy_name, deputy_position
      } = req.body;
      db.prepare(`
        UPDATE projects 
        SET project_code = ?, title = ?, department = ?, budget_amount = ?, budget_source = ?,
            project_nature = ?, necessity_reason = ?, material_usage_date = ?, allocated_budget = ?, procured_amount = ?,
            dept_head_name = ?, dept_head_position = ?, deputy_name = ?, deputy_position = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        project_code, title, department, budget_amount, budget_source,
        project_nature, necessity_reason, material_usage_date, allocated_budget, procured_amount,
        dept_head_name, dept_head_position, deputy_name, deputy_position,
        req.params.id
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  // Budget Source Routes
  app.get("/api/budget-sources", (req, res) => {
    try {
      const sources = db.prepare("SELECT * FROM budget_sources").all();
      res.json(sources);
    } catch (err) {
      console.error("Error fetching budget sources:", err);
      res.status(500).json({ error: "Failed to fetch budget sources" });
    }
  });

  app.post("/api/budget-sources", (req, res) => {
    const { name } = req.body;
    try {
      const info = db.prepare("INSERT INTO budget_sources (name) VALUES (?)").run(name);
      res.json({ id: info.lastInsertRowid, name });
    } catch (err) {
      res.status(500).json({ error: "Failed to add budget source" });
    }
  });

  app.delete("/api/budget-sources/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM budget_sources WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete budget source" });
    }
  });

  // Expense Category Routes
  app.get("/api/expense-categories", (req, res) => {
    try {
      const categories = db.prepare("SELECT * FROM expense_categories").all();
      res.json(categories);
    } catch (err) {
      console.error("Error fetching expense categories:", err);
      res.status(500).json({ error: "Failed to fetch expense categories" });
    }
  });

  app.post("/api/expense-categories", (req, res) => {
    const { name } = req.body;
    try {
      const info = db.prepare("INSERT INTO expense_categories (name) VALUES (?)").run(name);
      res.json({ id: info.lastInsertRowid, name });
    } catch (err) {
      console.error("Error adding expense category:", err);
      res.status(500).json({ error: "Failed to add expense category" });
    }
  });

  app.delete("/api/expense-categories/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM expense_categories WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting expense category:", err);
      res.status(500).json({ error: "Failed to delete expense category" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Explicit fallback for SPA in development if vite.middlewares doesn't catch it
    app.use("*", async (req, res, next) => {
      if (req.originalUrl.startsWith("/api")) {
        return next();
      }
      try {
        const fs = await import("fs");
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
