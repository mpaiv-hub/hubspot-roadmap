-- ============================================================
-- HubSpot Roadmap Seed SQL
-- Target: https://hthpobqikjwvsokmippr.supabase.co
-- ============================================================

-- 1. Create hs_roadmap_comments table
CREATE TABLE IF NOT EXISTS hs_roadmap_comments (
  id text PRIMARY KEY,
  task_id text NOT NULL,
  author text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE hs_roadmap_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hs_roadmap_comments' AND policyname = 'Allow all'
  ) THEN
    CREATE POLICY "Allow all" ON hs_roadmap_comments FOR ALL USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- 2. Delete all existing data (order matters for FK constraints)
DELETE FROM hs_roadmap_subtasks;
DELETE FROM hs_roadmap_tasks;
DELETE FROM hs_roadmap_phases;
DELETE FROM hs_roadmap_state;
DELETE FROM hs_step_status;
DELETE FROM hs_roadmap_comments;

-- 3. Insert Phases
INSERT INTO hs_roadmap_phases (id, title, subtitle, duration, color, "order", created_at, updated_at) VALUES
  ('phase-1', 'Pipeline Cleanup & Consolidation', 'Remove unused financing, trade-in, and prequalified pipelines', 'Week 1-2', 'teal', 1, now(), now()),
  ('phase-2', 'Retail Deal Improvements', 'Property syncs, deduplication, and vehicle notification integration', 'Week 2-5', 'blue', 2, now(), now()),
  ('phase-3', 'STC Deal Improvements', 'Rebuild STC lead scoring model', 'Week 3-6', 'amber', 3, now(), now()),
  ('phase-4', 'Vehicle Custom Object', 'Centralized vehicle data sync and speed-to-sale classification', 'Week 2-8', 'teal', 4, now(), now()),
  ('phase-5', 'Presale Outbound & Queue Overhaul', 'Rebuild presale SDR queue with prioritized daily lead lists', 'Week 5-8', 'blue', 5, now(), now()),
  ('phase-6', 'Conversations & Communication', 'HubSpot Conversations, SMS migration, and call logging', 'Week 3-10', 'pink', 6, now(), now()),
  ('phase-7', 'Additional Opportunities', 'Legacy cleanup, lifecycle fixes, reporting, and tooling costs', 'Week 4-10', 'amber', 7, now(), now()),
  ('phase-8', 'Lead Lifecycle Configuration', 'Define retail and STC lead stage definitions', 'Week 6-10', 'pink', 8, now(), now());

-- 4. Insert Tasks

-- Phase 1: Pipeline Cleanup & Consolidation
INSERT INTO hs_roadmap_tasks (id, phase_id, title, description, owner, output, dependency, "order", created_at, updated_at) VALUES
  ('phase-1-task-1', 'phase-1', 'Remove Financing Pipelines', 'Remove 5 unused financing pipelines (Toronto, Halifax, Vancouver, Calgary, Saskatchewan)', 'Mark', NULL, NULL, 1, now(), now()),
  ('phase-1-task-2', 'phase-1', 'Remove Trade-In Pipelines', 'Remove Halifax Trade-Ins pipeline (redundant)', 'Mark', NULL, NULL, 2, now(), now()),
  ('phase-1-task-3', 'phase-1', 'Remove Prequalified/Preapproval Pipelines', 'Remove 3 pipelines now captured via custom events (Prequalified Leads Halifax, Halifax Preapprovals, Toronto Preapprovals)', 'Mark', NULL, NULL, 3, now(), now());

-- Phase 2: Retail Deal Improvements
INSERT INTO hs_roadmap_tasks (id, phase_id, title, description, owner, output, dependency, "order", created_at, updated_at) VALUES
  ('phase-2-task-1', 'phase-2', 'New Property Syncs from Admin', 'Sync Admin Deal Status, Admin Deal State, and Delivery Date properties from admin to HubSpot deals', 'Mark', NULL, 'Admin Product Team', 1, now(), now()),
  ('phase-2-task-2', 'phase-2', 'Eliminate Google Sheets Middleman', 'Replace retail-to-dispatch Google Sheets handoff with direct Admin to HubSpot sync', 'Mark', NULL, 'Admin Product Team', 2, now(), now()),
  ('phase-2-task-3', 'phase-2', 'New Lead Deal Deduplication', 'Build fuzzy lookup logic to prevent duplicate deals when same customer engages via website then checkout', 'Mark', NULL, 'Admin Product Team', 3, now(), now()),
  ('phase-2-task-4', 'phase-2', 'Vehicle Notification Integration', 'Admin to HubSpot sync for Track Price / Notify Me website actions creating New Lead deals', 'Mark', NULL, 'Admin Product Team + Dedup Logic', 4, now(), now());

-- Phase 3: STC Deal Improvements
INSERT INTO hs_roadmap_tasks (id, phase_id, title, description, owner, output, dependency, "order", created_at, updated_at) VALUES
  ('phase-3-task-1', 'phase-3', 'Lead Score V2', 'Rebuild STC lead score with Offer Margin, Offer Spread, Deal Type, Vehicle Equity, and STC State', 'Mark', NULL, 'Data Team', 1, now(), now());

-- Phase 4: Vehicle Custom Object
INSERT INTO hs_roadmap_tasks (id, phase_id, title, description, owner, output, dependency, "order", created_at, updated_at) VALUES
  ('phase-4-task-1', 'phase-4', 'Vehicle Object Sync', 'Sync Vehicle custom object into HubSpot with centralized vehicle data and associations', 'Steve', NULL, 'Steve''s sync work', 1, now(), now()),
  ('phase-4-task-2', 'phase-4', 'Speed to Sale Classification', 'Categorize vehicles as Fast/Medium/Slow movers based on year, make, model, damage, mileage, price', 'TBD', NULL, 'Vehicle Object Sync', 2, now(), now());

-- Phase 5: Presale Outbound & Queue Overhaul
INSERT INTO hs_roadmap_tasks (id, phase_id, title, description, owner, output, dependency, "order", created_at, updated_at) VALUES
  ('phase-5-task-1', 'phase-5', 'Queue Rebuild', 'Rebuild presale SDR queue system with prioritized daily lead lists', 'Mark', NULL, 'New lead sources + Lead Score', 1, now(), now());

-- Phase 6: Conversations & Communication
INSERT INTO hs_roadmap_tasks (id, phase_id, title, description, owner, output, dependency, "order", created_at, updated_at) VALUES
  ('phase-6-task-1', 'phase-6', 'Conversations Center Config', 'Configure HubSpot Conversations Center for Retail and STC teams', 'Mark', NULL, NULL, 1, now(), now()),
  ('phase-6-task-2', 'phase-6', 'HubSpot Inbox Transition', 'Transition Revenue and STC Sales teams to HubSpot Inbox', 'TBD', 'April 2026', NULL, 2, now(), now()),
  ('phase-6-task-3', 'phase-6', 'Salesmsg to Sinch Migration', 'Migrate SMS tooling from Salesmsg to Sinch', 'Mark', 'April 2026', 'Exec contract signoff', 3, now(), now()),
  ('phase-6-task-4', 'phase-6', 'Aircall Call Logging Middleware', 'Build webhook middleware to post Aircall call summaries into HubSpot Conversations threads', 'Mark', NULL, 'Conversations Center (6a)', 4, now(), now()),
  ('phase-6-task-5', 'phase-6', 'Intercom Conversation Logging', 'Build webhook to log Intercom chat interactions onto HubSpot contact records', 'Mark', 'Low priority', NULL, 5, now(), now()),
  ('phase-6-task-6', 'phase-6', 'Follow-Up Templatization', 'Build templates and automated triggers for common sales follow-up messages', 'TBD', 'May 2026', NULL, 6, now(), now());

-- Phase 7: Additional Opportunities
INSERT INTO hs_roadmap_tasks (id, phase_id, title, description, owner, output, dependency, "order", created_at, updated_at) VALUES
  ('phase-7-task-1', 'phase-7', 'Legacy Deal Backlog', 'Archive or close ~85.9% of open deals that are pre-2025 to improve data quality', 'Mark', NULL, NULL, 1, now(), now()),
  ('phase-7-task-2', 'phase-7', 'Retail Lifecycle Data Integrity', 'Fix workflow gaps causing missing SAL timestamps and stage skipping across 9 stages', 'Mark', NULL, NULL, 2, now(), now()),
  ('phase-7-task-3', 'phase-7', 'Reporting Infrastructure', 'Evaluate Looker Studio + BigQuery for advanced reporting beyond HubSpot native limits', 'Mark', NULL, 'Data Team', 3, now(), now()),
  ('phase-7-task-4', 'phase-7', 'Tooling Cost Consolidation', 'Complete RevOps tooling cost workbook for budget visibility', 'Mark', NULL, NULL, 4, now(), now());

-- Phase 8: Lead Lifecycle Configuration
INSERT INTO hs_roadmap_tasks (id, phase_id, title, description, owner, output, dependency, "order", created_at, updated_at) VALUES
  ('phase-8-task-1', 'phase-8', 'Retail Lead Stage Definitions', 'Define clear stage definitions for contacts entering Intent retail lifecycle stage', 'Mark', NULL, 'Lifecycle Data Integrity (7b)', 1, now(), now()),
  ('phase-8-task-2', 'phase-8', 'STC Lead Stage Definitions', 'Apply stage definition exercise to STC contacts entering Intent STC lifecycle stage', 'Mark', NULL, NULL, 2, now(), now());

-- 5. Insert Subtasks (Steps)

-- Phase 1, Task 1: Remove Financing Pipelines
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-1-task-1-step-1', 'phase-1-task-1', 'Audit pipeline usage', 1, now(), now()),
  ('phase-1-task-1-step-2', 'phase-1-task-1', 'Confirm no active deals', 2, now(), now()),
  ('phase-1-task-1-step-3', 'phase-1-task-1', 'Delete pipelines', 3, now(), now()),
  ('phase-1-task-1-step-4', 'phase-1-task-1', 'Verify reporting unaffected', 4, now(), now());

-- Phase 1, Task 2: Remove Trade-In Pipelines
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-1-task-2-step-1', 'phase-1-task-2', 'Confirm redundancy', 1, now(), now()),
  ('phase-1-task-2-step-2', 'phase-1-task-2', 'Delete pipeline', 2, now(), now());

-- Phase 1, Task 3: Remove Prequalified/Preapproval Pipelines
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-1-task-3-step-1', 'phase-1-task-3', 'Verify custom events capturing data', 1, now(), now()),
  ('phase-1-task-3-step-2', 'phase-1-task-3', 'Delete pipelines', 2, now(), now()),
  ('phase-1-task-3-step-3', 'phase-1-task-3', 'Update documentation', 3, now(), now());

-- Phase 2, Task 1: New Property Syncs from Admin
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-2-task-1-step-1', 'phase-2-task-1', 'Define property specs', 1, now(), now()),
  ('phase-2-task-1-step-2', 'phase-2-task-1', 'Coordinate with admin team', 2, now(), now()),
  ('phase-2-task-1-step-3', 'phase-2-task-1', 'Build sync', 3, now(), now()),
  ('phase-2-task-1-step-4', 'phase-2-task-1', 'Test and validate', 4, now(), now());

-- Phase 2, Task 2: Eliminate Google Sheets Middleman
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-2-task-2-step-1', 'phase-2-task-2', 'Map current Google Sheets flow', 1, now(), now()),
  ('phase-2-task-2-step-2', 'phase-2-task-2', 'Design direct sync architecture', 2, now(), now()),
  ('phase-2-task-2-step-3', 'phase-2-task-2', 'Implement Admin to HubSpot integration', 3, now(), now()),
  ('phase-2-task-2-step-4', 'phase-2-task-2', 'Deprecate Google Sheets dependency', 4, now(), now());

-- Phase 2, Task 3: New Lead Deal Deduplication
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-2-task-3-step-1', 'phase-2-task-3', 'Define matching criteria (contact + vehicle)', 1, now(), now()),
  ('phase-2-task-3-step-2', 'phase-2-task-3', 'Build fuzzy lookup logic', 2, now(), now()),
  ('phase-2-task-3-step-3', 'phase-2-task-3', 'Test edge cases', 3, now(), now()),
  ('phase-2-task-3-step-4', 'phase-2-task-3', 'Deploy and monitor', 4, now(), now());

-- Phase 2, Task 4: Vehicle Notification Integration
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-2-task-4-step-1', 'phase-2-task-4', 'Review tech spec', 1, now(), now()),
  ('phase-2-task-4-step-2', 'phase-2-task-4', 'Coordinate with admin product team', 2, now(), now()),
  ('phase-2-task-4-step-3', 'phase-2-task-4', 'Implement sync', 3, now(), now()),
  ('phase-2-task-4-step-4', 'phase-2-task-4', 'Integrate with dedup logic', 4, now(), now());

-- Phase 3, Task 1: Lead Score V2
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-3-task-1-step-1', 'phase-3-task-1', 'Finalize scoring properties with team leads', 1, now(), now()),
  ('phase-3-task-1-step-2', 'phase-3-task-1', 'Submit data request to data team', 2, now(), now()),
  ('phase-3-task-1-step-3', 'phase-3-task-1', 'Build scoring model in HubSpot', 3, now(), now()),
  ('phase-3-task-1-step-4', 'phase-3-task-1', 'Sync with Ben S on marketing scoring alignment', 4, now(), now()),
  ('phase-3-task-1-step-5', 'phase-3-task-1', 'Test and calibrate', 5, now(), now());

-- Phase 4, Task 1: Vehicle Object Sync
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-4-task-1-step-1', 'phase-4-task-1', 'Define vehicle object schema', 1, now(), now()),
  ('phase-4-task-1-step-2', 'phase-4-task-1', 'Build sync from admin', 2, now(), now()),
  ('phase-4-task-1-step-3', 'phase-4-task-1', 'Configure associations (deals, contacts)', 3, now(), now()),
  ('phase-4-task-1-step-4', 'phase-4-task-1', 'Test data integrity', 4, now(), now());

-- Phase 4, Task 2: Speed to Sale Classification
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-4-task-2-step-1', 'phase-4-task-2', 'Define classification criteria', 1, now(), now()),
  ('phase-4-task-2-step-2', 'phase-4-task-2', 'Build classification logic', 2, now(), now()),
  ('phase-4-task-2-step-3', 'phase-4-task-2', 'Apply to vehicle objects', 3, now(), now()),
  ('phase-4-task-2-step-4', 'phase-4-task-2', 'Enable downstream reporting', 4, now(), now());

-- Phase 5, Task 1: Queue Rebuild
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-5-task-1-step-1', 'phase-5-task-1', 'Audit current queue structure', 1, now(), now()),
  ('phase-5-task-1-step-2', 'phase-5-task-1', 'Design new queue logic', 2, now(), now()),
  ('phase-5-task-1-step-3', 'phase-5-task-1', 'Incorporate growth team lead sources', 3, now(), now()),
  ('phase-5-task-1-step-4', 'phase-5-task-1', 'Implement daily volume management', 4, now(), now()),
  ('phase-5-task-1-step-5', 'phase-5-task-1', 'Test with SDR team', 5, now(), now());

-- Phase 6, Task 1: Conversations Center Config
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-6-task-1-step-1', 'phase-6-task-1', 'Design inbox structure with Abhi', 1, now(), now()),
  ('phase-6-task-1-step-2', 'phase-6-task-1', 'Configure channels (calls, emails, SMS)', 2, now(), now()),
  ('phase-6-task-1-step-3', 'phase-6-task-1', 'Build UI for Rex integration', 3, now(), now()),
  ('phase-6-task-1-step-4', 'phase-6-task-1', 'Plan Admin integration', 4, now(), now());

-- Phase 6, Task 2: HubSpot Inbox Transition
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-6-task-2-step-1', 'phase-6-task-2', 'Identify current tooling gaps', 1, now(), now()),
  ('phase-6-task-2-step-2', 'phase-6-task-2', 'Plan migration timeline', 2, now(), now()),
  ('phase-6-task-2-step-3', 'phase-6-task-2', 'Train sales teams', 3, now(), now()),
  ('phase-6-task-2-step-4', 'phase-6-task-2', 'Execute cutover', 4, now(), now());

-- Phase 6, Task 3: Salesmsg to Sinch Migration
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-6-task-3-step-1', 'phase-6-task-3', 'Get exec contract approval', 1, now(), now()),
  ('phase-6-task-3-step-2', 'phase-6-task-3', 'Plan migration', 2, now(), now()),
  ('phase-6-task-3-step-3', 'phase-6-task-3', 'Execute migration', 3, now(), now()),
  ('phase-6-task-3-step-4', 'phase-6-task-3', 'Decommission Salesmsg', 4, now(), now());

-- Phase 6, Task 4: Aircall Call Logging Middleware
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-6-task-4-step-1', 'phase-6-task-4', 'Design webhook listener architecture', 1, now(), now()),
  ('phase-6-task-4-step-2', 'phase-6-task-4', 'Build call summary formatter', 2, now(), now()),
  ('phase-6-task-4-step-3', 'phase-6-task-4', 'Integrate with HubSpot Conversations API', 3, now(), now()),
  ('phase-6-task-4-step-4', 'phase-6-task-4', 'Test end-to-end', 4, now(), now());

-- Phase 6, Task 5: Intercom Conversation Logging
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-6-task-5-step-1', 'phase-6-task-5', 'Design webhook integration', 1, now(), now()),
  ('phase-6-task-5-step-2', 'phase-6-task-5', 'Build Intercom to HubSpot sync', 2, now(), now()),
  ('phase-6-task-5-step-3', 'phase-6-task-5', 'Test logging accuracy', 3, now(), now());

-- Phase 6, Task 6: Follow-Up Templatization
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-6-task-6-step-1', 'phase-6-task-6', 'Identify most common messages', 1, now(), now()),
  ('phase-6-task-6-step-2', 'phase-6-task-6', 'Build Phase 1 templates', 2, now(), now()),
  ('phase-6-task-6-step-3', 'phase-6-task-6', 'Build Phase 2 task reminders', 3, now(), now()),
  ('phase-6-task-6-step-4', 'phase-6-task-6', 'Build Phase 3 automated triggers', 4, now(), now());

-- Phase 7, Task 1: Legacy Deal Backlog
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-7-task-1-step-1', 'phase-7-task-1', 'Define archival criteria', 1, now(), now()),
  ('phase-7-task-1-step-2', 'phase-7-task-1', 'Build bulk update script', 2, now(), now()),
  ('phase-7-task-1-step-3', 'phase-7-task-1', 'Execute in batches', 3, now(), now()),
  ('phase-7-task-1-step-4', 'phase-7-task-1', 'Validate pipeline metrics improvement', 4, now(), now());

-- Phase 7, Task 2: Retail Lifecycle Data Integrity
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-7-task-2-step-1', 'phase-7-task-2', 'Audit enrollment criteria', 1, now(), now()),
  ('phase-7-task-2-step-2', 'phase-7-task-2', 'Broaden SAL/Opportunity workflows', 2, now(), now()),
  ('phase-7-task-2-step-3', 'phase-7-task-2', 'Add validation guardrails', 3, now(), now()),
  ('phase-7-task-2-step-4', 'phase-7-task-2', 'Monitor data quality', 4, now(), now());

-- Phase 7, Task 3: Reporting Infrastructure
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-7-task-3-step-1', 'phase-7-task-3', 'Complete Sale Pending reconciliation in Looker', 1, now(), now()),
  ('phase-7-task-3-step-2', 'phase-7-task-3', 'Assess BigQuery integration scope', 2, now(), now()),
  ('phase-7-task-3-step-3', 'phase-7-task-3', 'Build initial dashboards', 3, now(), now()),
  ('phase-7-task-3-step-4', 'phase-7-task-3', 'Document reporting source of truth', 4, now(), now());

-- Phase 7, Task 4: Tooling Cost Consolidation
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-7-task-4-step-1', 'phase-7-task-4', 'Finish GL export breakdown', 1, now(), now()),
  ('phase-7-task-4-step-2', 'phase-7-task-4', 'Map costs to tools', 2, now(), now()),
  ('phase-7-task-4-step-3', 'phase-7-task-4', 'Identify consolidation opportunities', 3, now(), now()),
  ('phase-7-task-4-step-4', 'phase-7-task-4', 'Present to finance', 4, now(), now());

-- Phase 8, Task 1: Retail Lead Stage Definitions
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-8-task-1-step-1', 'phase-8-task-1', 'Define stage criteria', 1, now(), now()),
  ('phase-8-task-1-step-2', 'phase-8-task-1', 'Broaden enrollment to all entry paths', 2, now(), now()),
  ('phase-8-task-1-step-3', 'phase-8-task-1', 'Fix SAL timestamp gaps', 3, now(), now()),
  ('phase-8-task-1-step-4', 'phase-8-task-1', 'Document source of truth', 4, now(), now());

-- Phase 8, Task 2: STC Lead Stage Definitions
INSERT INTO hs_roadmap_subtasks (id, task_id, text, "order", created_at, updated_at) VALUES
  ('phase-8-task-2-step-1', 'phase-8-task-2', 'Define STC stage criteria', 1, now(), now()),
  ('phase-8-task-2-step-2', 'phase-8-task-2', 'Configure workflow enrollment', 2, now(), now()),
  ('phase-8-task-2-step-3', 'phase-8-task-2', 'Test stage progression', 3, now(), now()),
  ('phase-8-task-2-step-4', 'phase-8-task-2', 'Align with retail lifecycle', 4, now(), now());
