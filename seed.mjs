import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hthpobqikjwvsokmippr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0aHBvYnFpa2p3dnNva21pcHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDg4NzQsImV4cCI6MjA4Mzk4NDg3NH0.OhOcCTVYMGzOOIU105GmSfxT72Im-MZ3Rge8jvC5XLU'
)

async function seed() {
  console.log('Clearing existing data...')
  await supabase.from('roadmap_subtasks').delete().neq('id', '')
  await supabase.from('roadmap_tasks').delete().neq('id', '')
  await supabase.from('roadmap_phases').delete().neq('id', '')
  await supabase.from('roadmap_state').delete().neq('id', '')
  await supabase.from('step_status').delete().neq('id', '')
  await supabase.from('roadmap_comments').delete().neq('id', '')
  console.log('Cleared.')

  console.log('Inserting phases...')
  const { error: pErr } = await supabase.from('roadmap_phases').insert([
    { id: 'phase-1', title: 'Pipeline Cleanup & Consolidation', subtitle: 'Remove unused financing, trade-in, and prequalified pipelines', duration: 'Week 1-2', color: 'teal', order: 1 },
    { id: 'phase-2', title: 'Retail Deal Improvements', subtitle: 'Property syncs, deduplication, and vehicle notification integration', duration: 'Week 2-5', color: 'blue', order: 2 },
    { id: 'phase-3', title: 'STC Deal Improvements', subtitle: 'Rebuild STC lead scoring model', duration: 'Week 3-6', color: 'amber', order: 3 },
    { id: 'phase-4', title: 'Vehicle Custom Object', subtitle: 'Centralized vehicle data sync and speed-to-sale classification', duration: 'Week 2-8', color: 'teal', order: 4 },
    { id: 'phase-5', title: 'Presale Outbound & Queue Overhaul', subtitle: 'Rebuild presale SDR queue with prioritized daily lead lists', duration: 'Week 5-8', color: 'blue', order: 5 },
    { id: 'phase-6', title: 'Conversations & Communication', subtitle: 'HubSpot Conversations, SMS migration, and call logging', duration: 'Week 3-10', color: 'pink', order: 6 },
    { id: 'phase-7', title: 'Additional Opportunities', subtitle: 'Legacy cleanup, lifecycle fixes, reporting, and tooling costs', duration: 'Week 4-10', color: 'amber', order: 7 },
    { id: 'phase-8', title: 'Lead Lifecycle Configuration', subtitle: 'Define retail and STC lead stage definitions', duration: 'Week 6-10', color: 'pink', order: 8 },
  ])
  if (pErr) { console.error('Phase insert error:', pErr); return }
  console.log('Phases inserted.')

  console.log('Inserting tasks...')
  const tasks = [
    // Phase 1
    { id: 'phase-1-task-1', phase_id: 'phase-1', title: 'Remove Financing Pipelines', description: 'Remove 5 unused financing pipelines (Toronto, Halifax, Vancouver, Calgary, Saskatchewan)', owner: 'Mark', output: null, dependency: null, order: 1 },
    { id: 'phase-1-task-2', phase_id: 'phase-1', title: 'Remove Trade-In Pipelines', description: 'Remove Halifax Trade-Ins pipeline (redundant)', owner: 'Mark', output: null, dependency: null, order: 2 },
    { id: 'phase-1-task-3', phase_id: 'phase-1', title: 'Remove Prequalified/Preapproval Pipelines', description: 'Remove 3 pipelines now captured via custom events (Prequalified Leads Halifax, Halifax Preapprovals, Toronto Preapprovals)', owner: 'Mark', output: null, dependency: null, order: 3 },
    // Phase 2
    { id: 'phase-2-task-1', phase_id: 'phase-2', title: 'New Property Syncs from Admin', description: 'Sync Admin Deal Status, Admin Deal State, and Delivery Date properties from admin to HubSpot deals', owner: 'Mark', output: null, dependency: 'Admin Product Team', order: 1 },
    { id: 'phase-2-task-2', phase_id: 'phase-2', title: 'Eliminate Google Sheets Middleman', description: 'Replace retail-to-dispatch Google Sheets handoff with direct Admin to HubSpot sync', owner: 'Mark', output: null, dependency: 'Admin Product Team', order: 2 },
    { id: 'phase-2-task-3', phase_id: 'phase-2', title: 'New Lead Deal Deduplication', description: 'Build fuzzy lookup logic to prevent duplicate deals when same customer engages via website then checkout', owner: 'Mark', output: null, dependency: 'Admin Product Team', order: 3 },
    { id: 'phase-2-task-4', phase_id: 'phase-2', title: 'Vehicle Notification Integration', description: 'Admin to HubSpot sync for Track Price / Notify Me website actions creating New Lead deals', owner: 'Mark', output: null, dependency: 'Admin Product Team + Dedup Logic', order: 4 },
    // Phase 3
    { id: 'phase-3-task-1', phase_id: 'phase-3', title: 'Lead Score V2', description: 'Rebuild STC lead score with Offer Margin, Offer Spread, Deal Type, Vehicle Equity, and STC State', owner: 'Mark', output: null, dependency: 'Data Team', order: 1 },
    // Phase 4
    { id: 'phase-4-task-1', phase_id: 'phase-4', title: 'Vehicle Object Sync', description: 'Sync Vehicle custom object into HubSpot with centralized vehicle data and associations', owner: 'Steve', output: null, dependency: "Steve's sync work", order: 1 },
    { id: 'phase-4-task-2', phase_id: 'phase-4', title: 'Speed to Sale Classification', description: 'Categorize vehicles as Fast/Medium/Slow movers based on year, make, model, damage, mileage, price', owner: 'TBD', output: null, dependency: 'Vehicle Object Sync', order: 2 },
    // Phase 5
    { id: 'phase-5-task-1', phase_id: 'phase-5', title: 'Queue Rebuild', description: 'Rebuild presale SDR queue system with prioritized daily lead lists', owner: 'Mark', output: null, dependency: 'New lead sources + Lead Score', order: 1 },
    // Phase 6
    { id: 'phase-6-task-1', phase_id: 'phase-6', title: 'Conversations Center Config', description: 'Configure HubSpot Conversations Center for Retail and STC teams', owner: 'Mark', output: null, dependency: null, order: 1 },
    { id: 'phase-6-task-2', phase_id: 'phase-6', title: 'HubSpot Inbox Transition', description: 'Transition Revenue and STC Sales teams to HubSpot Inbox', owner: 'TBD', output: 'April 2026', dependency: null, order: 2 },
    { id: 'phase-6-task-3', phase_id: 'phase-6', title: 'Salesmsg to Sinch Migration', description: 'Migrate SMS tooling from Salesmsg to Sinch', owner: 'Mark', output: 'April 2026', dependency: 'Exec contract signoff', order: 3 },
    { id: 'phase-6-task-4', phase_id: 'phase-6', title: 'Aircall Call Logging Middleware', description: 'Build webhook middleware to post Aircall call summaries into HubSpot Conversations threads', owner: 'Mark', output: null, dependency: 'Conversations Center (6a)', order: 4 },
    { id: 'phase-6-task-5', phase_id: 'phase-6', title: 'Intercom Conversation Logging', description: 'Build webhook to log Intercom chat interactions onto HubSpot contact records', owner: 'Mark', output: 'Low priority', dependency: null, order: 5 },
    { id: 'phase-6-task-6', phase_id: 'phase-6', title: 'Follow-Up Templatization', description: 'Build templates and automated triggers for common sales follow-up messages', owner: 'TBD', output: 'May 2026', dependency: null, order: 6 },
    // Phase 7
    { id: 'phase-7-task-1', phase_id: 'phase-7', title: 'Legacy Deal Backlog', description: 'Archive or close ~85.9% of open deals that are pre-2025 to improve data quality', owner: 'Mark', output: null, dependency: null, order: 1 },
    { id: 'phase-7-task-2', phase_id: 'phase-7', title: 'Retail Lifecycle Data Integrity', description: 'Fix workflow gaps causing missing SAL timestamps and stage skipping across 9 stages', owner: 'Mark', output: null, dependency: null, order: 2 },
    { id: 'phase-7-task-3', phase_id: 'phase-7', title: 'Reporting Infrastructure', description: 'Evaluate Looker Studio + BigQuery for advanced reporting beyond HubSpot native limits', owner: 'Mark', output: null, dependency: 'Data Team', order: 3 },
    { id: 'phase-7-task-4', phase_id: 'phase-7', title: 'Tooling Cost Consolidation', description: 'Complete RevOps tooling cost workbook for budget visibility', owner: 'Mark', output: null, dependency: null, order: 4 },
    // Phase 8
    { id: 'phase-8-task-1', phase_id: 'phase-8', title: 'Retail Lead Stage Definitions', description: 'Define clear stage definitions for contacts entering Intent retail lifecycle stage', owner: 'Mark', output: null, dependency: 'Lifecycle Data Integrity (7b)', order: 1 },
    { id: 'phase-8-task-2', phase_id: 'phase-8', title: 'STC Lead Stage Definitions', description: 'Apply stage definition exercise to STC contacts entering Intent STC lifecycle stage', owner: 'Mark', output: null, dependency: null, order: 2 },
  ]
  const { error: tErr } = await supabase.from('roadmap_tasks').insert(tasks)
  if (tErr) { console.error('Task insert error:', tErr); return }
  console.log(`${tasks.length} tasks inserted.`)

  console.log('Inserting subtasks...')
  const subtasks = [
    // Phase 1 Task 1
    { id: 'phase-1-task-1-step-1', task_id: 'phase-1-task-1', text: 'Audit pipeline usage', order: 1 },
    { id: 'phase-1-task-1-step-2', task_id: 'phase-1-task-1', text: 'Confirm no active deals', order: 2 },
    { id: 'phase-1-task-1-step-3', task_id: 'phase-1-task-1', text: 'Delete pipelines', order: 3 },
    { id: 'phase-1-task-1-step-4', task_id: 'phase-1-task-1', text: 'Verify reporting unaffected', order: 4 },
    // Phase 1 Task 2
    { id: 'phase-1-task-2-step-1', task_id: 'phase-1-task-2', text: 'Confirm redundancy', order: 1 },
    { id: 'phase-1-task-2-step-2', task_id: 'phase-1-task-2', text: 'Delete pipeline', order: 2 },
    // Phase 1 Task 3
    { id: 'phase-1-task-3-step-1', task_id: 'phase-1-task-3', text: 'Verify custom events capturing data', order: 1 },
    { id: 'phase-1-task-3-step-2', task_id: 'phase-1-task-3', text: 'Delete pipelines', order: 2 },
    { id: 'phase-1-task-3-step-3', task_id: 'phase-1-task-3', text: 'Update documentation', order: 3 },
    // Phase 2 Task 1
    { id: 'phase-2-task-1-step-1', task_id: 'phase-2-task-1', text: 'Define property specs', order: 1 },
    { id: 'phase-2-task-1-step-2', task_id: 'phase-2-task-1', text: 'Coordinate with admin team', order: 2 },
    { id: 'phase-2-task-1-step-3', task_id: 'phase-2-task-1', text: 'Build sync', order: 3 },
    { id: 'phase-2-task-1-step-4', task_id: 'phase-2-task-1', text: 'Test and validate', order: 4 },
    // Phase 2 Task 2
    { id: 'phase-2-task-2-step-1', task_id: 'phase-2-task-2', text: 'Map current Google Sheets flow', order: 1 },
    { id: 'phase-2-task-2-step-2', task_id: 'phase-2-task-2', text: 'Design direct sync architecture', order: 2 },
    { id: 'phase-2-task-2-step-3', task_id: 'phase-2-task-2', text: 'Implement Admin to HubSpot integration', order: 3 },
    { id: 'phase-2-task-2-step-4', task_id: 'phase-2-task-2', text: 'Deprecate Google Sheets dependency', order: 4 },
    // Phase 2 Task 3
    { id: 'phase-2-task-3-step-1', task_id: 'phase-2-task-3', text: 'Define matching criteria (contact + vehicle)', order: 1 },
    { id: 'phase-2-task-3-step-2', task_id: 'phase-2-task-3', text: 'Build fuzzy lookup logic', order: 2 },
    { id: 'phase-2-task-3-step-3', task_id: 'phase-2-task-3', text: 'Test edge cases', order: 3 },
    { id: 'phase-2-task-3-step-4', task_id: 'phase-2-task-3', text: 'Deploy and monitor', order: 4 },
    // Phase 2 Task 4
    { id: 'phase-2-task-4-step-1', task_id: 'phase-2-task-4', text: 'Review tech spec', order: 1 },
    { id: 'phase-2-task-4-step-2', task_id: 'phase-2-task-4', text: 'Coordinate with admin product team', order: 2 },
    { id: 'phase-2-task-4-step-3', task_id: 'phase-2-task-4', text: 'Implement sync', order: 3 },
    { id: 'phase-2-task-4-step-4', task_id: 'phase-2-task-4', text: 'Integrate with dedup logic', order: 4 },
    // Phase 3 Task 1
    { id: 'phase-3-task-1-step-1', task_id: 'phase-3-task-1', text: 'Finalize scoring properties with team leads', order: 1 },
    { id: 'phase-3-task-1-step-2', task_id: 'phase-3-task-1', text: 'Submit data request to data team', order: 2 },
    { id: 'phase-3-task-1-step-3', task_id: 'phase-3-task-1', text: 'Build scoring model in HubSpot', order: 3 },
    { id: 'phase-3-task-1-step-4', task_id: 'phase-3-task-1', text: 'Sync with Ben S on marketing scoring alignment', order: 4 },
    { id: 'phase-3-task-1-step-5', task_id: 'phase-3-task-1', text: 'Test and calibrate', order: 5 },
    // Phase 4 Task 1
    { id: 'phase-4-task-1-step-1', task_id: 'phase-4-task-1', text: 'Define vehicle object schema', order: 1 },
    { id: 'phase-4-task-1-step-2', task_id: 'phase-4-task-1', text: 'Build sync from admin', order: 2 },
    { id: 'phase-4-task-1-step-3', task_id: 'phase-4-task-1', text: 'Configure associations (deals, contacts)', order: 3 },
    { id: 'phase-4-task-1-step-4', task_id: 'phase-4-task-1', text: 'Test data integrity', order: 4 },
    // Phase 4 Task 2
    { id: 'phase-4-task-2-step-1', task_id: 'phase-4-task-2', text: 'Define classification criteria', order: 1 },
    { id: 'phase-4-task-2-step-2', task_id: 'phase-4-task-2', text: 'Build classification logic', order: 2 },
    { id: 'phase-4-task-2-step-3', task_id: 'phase-4-task-2', text: 'Apply to vehicle objects', order: 3 },
    { id: 'phase-4-task-2-step-4', task_id: 'phase-4-task-2', text: 'Enable downstream reporting', order: 4 },
    // Phase 5 Task 1
    { id: 'phase-5-task-1-step-1', task_id: 'phase-5-task-1', text: 'Audit current queue structure', order: 1 },
    { id: 'phase-5-task-1-step-2', task_id: 'phase-5-task-1', text: 'Design new queue logic', order: 2 },
    { id: 'phase-5-task-1-step-3', task_id: 'phase-5-task-1', text: 'Incorporate growth team lead sources', order: 3 },
    { id: 'phase-5-task-1-step-4', task_id: 'phase-5-task-1', text: 'Implement daily volume management', order: 4 },
    { id: 'phase-5-task-1-step-5', task_id: 'phase-5-task-1', text: 'Test with SDR team', order: 5 },
    // Phase 6 Task 1
    { id: 'phase-6-task-1-step-1', task_id: 'phase-6-task-1', text: 'Design inbox structure with Abhi', order: 1 },
    { id: 'phase-6-task-1-step-2', task_id: 'phase-6-task-1', text: 'Configure channels (calls, emails, SMS)', order: 2 },
    { id: 'phase-6-task-1-step-3', task_id: 'phase-6-task-1', text: 'Build UI for Rex integration', order: 3 },
    { id: 'phase-6-task-1-step-4', task_id: 'phase-6-task-1', text: 'Plan Admin integration', order: 4 },
    // Phase 6 Task 2
    { id: 'phase-6-task-2-step-1', task_id: 'phase-6-task-2', text: 'Identify current tooling gaps', order: 1 },
    { id: 'phase-6-task-2-step-2', task_id: 'phase-6-task-2', text: 'Plan migration timeline', order: 2 },
    { id: 'phase-6-task-2-step-3', task_id: 'phase-6-task-2', text: 'Train sales teams', order: 3 },
    { id: 'phase-6-task-2-step-4', task_id: 'phase-6-task-2', text: 'Execute cutover', order: 4 },
    // Phase 6 Task 3
    { id: 'phase-6-task-3-step-1', task_id: 'phase-6-task-3', text: 'Get exec contract approval', order: 1 },
    { id: 'phase-6-task-3-step-2', task_id: 'phase-6-task-3', text: 'Plan migration', order: 2 },
    { id: 'phase-6-task-3-step-3', task_id: 'phase-6-task-3', text: 'Execute migration', order: 3 },
    { id: 'phase-6-task-3-step-4', task_id: 'phase-6-task-3', text: 'Decommission Salesmsg', order: 4 },
    // Phase 6 Task 4
    { id: 'phase-6-task-4-step-1', task_id: 'phase-6-task-4', text: 'Design webhook listener architecture', order: 1 },
    { id: 'phase-6-task-4-step-2', task_id: 'phase-6-task-4', text: 'Build call summary formatter', order: 2 },
    { id: 'phase-6-task-4-step-3', task_id: 'phase-6-task-4', text: 'Integrate with HubSpot Conversations API', order: 3 },
    { id: 'phase-6-task-4-step-4', task_id: 'phase-6-task-4', text: 'Test end-to-end', order: 4 },
    // Phase 6 Task 5
    { id: 'phase-6-task-5-step-1', task_id: 'phase-6-task-5', text: 'Design webhook integration', order: 1 },
    { id: 'phase-6-task-5-step-2', task_id: 'phase-6-task-5', text: 'Build Intercom to HubSpot sync', order: 2 },
    { id: 'phase-6-task-5-step-3', task_id: 'phase-6-task-5', text: 'Test logging accuracy', order: 3 },
    // Phase 6 Task 6
    { id: 'phase-6-task-6-step-1', task_id: 'phase-6-task-6', text: 'Identify most common messages', order: 1 },
    { id: 'phase-6-task-6-step-2', task_id: 'phase-6-task-6', text: 'Build Phase 1 templates', order: 2 },
    { id: 'phase-6-task-6-step-3', task_id: 'phase-6-task-6', text: 'Build Phase 2 task reminders', order: 3 },
    { id: 'phase-6-task-6-step-4', task_id: 'phase-6-task-6', text: 'Build Phase 3 automated triggers', order: 4 },
    // Phase 7 Task 1
    { id: 'phase-7-task-1-step-1', task_id: 'phase-7-task-1', text: 'Define archival criteria', order: 1 },
    { id: 'phase-7-task-1-step-2', task_id: 'phase-7-task-1', text: 'Build bulk update script', order: 2 },
    { id: 'phase-7-task-1-step-3', task_id: 'phase-7-task-1', text: 'Execute in batches', order: 3 },
    { id: 'phase-7-task-1-step-4', task_id: 'phase-7-task-1', text: 'Validate pipeline metrics improvement', order: 4 },
    // Phase 7 Task 2
    { id: 'phase-7-task-2-step-1', task_id: 'phase-7-task-2', text: 'Audit enrollment criteria', order: 1 },
    { id: 'phase-7-task-2-step-2', task_id: 'phase-7-task-2', text: 'Broaden SAL/Opportunity workflows', order: 2 },
    { id: 'phase-7-task-2-step-3', task_id: 'phase-7-task-2', text: 'Add validation guardrails', order: 3 },
    { id: 'phase-7-task-2-step-4', task_id: 'phase-7-task-2', text: 'Monitor data quality', order: 4 },
    // Phase 7 Task 3
    { id: 'phase-7-task-3-step-1', task_id: 'phase-7-task-3', text: 'Complete Sale Pending reconciliation in Looker', order: 1 },
    { id: 'phase-7-task-3-step-2', task_id: 'phase-7-task-3', text: 'Assess BigQuery integration scope', order: 2 },
    { id: 'phase-7-task-3-step-3', task_id: 'phase-7-task-3', text: 'Build initial dashboards', order: 3 },
    { id: 'phase-7-task-3-step-4', task_id: 'phase-7-task-3', text: 'Document reporting source of truth', order: 4 },
    // Phase 7 Task 4
    { id: 'phase-7-task-4-step-1', task_id: 'phase-7-task-4', text: 'Finish GL export breakdown', order: 1 },
    { id: 'phase-7-task-4-step-2', task_id: 'phase-7-task-4', text: 'Map costs to tools', order: 2 },
    { id: 'phase-7-task-4-step-3', task_id: 'phase-7-task-4', text: 'Identify consolidation opportunities', order: 3 },
    { id: 'phase-7-task-4-step-4', task_id: 'phase-7-task-4', text: 'Present to finance', order: 4 },
    // Phase 8 Task 1
    { id: 'phase-8-task-1-step-1', task_id: 'phase-8-task-1', text: 'Define stage criteria', order: 1 },
    { id: 'phase-8-task-1-step-2', task_id: 'phase-8-task-1', text: 'Broaden enrollment to all entry paths', order: 2 },
    { id: 'phase-8-task-1-step-3', task_id: 'phase-8-task-1', text: 'Fix SAL timestamp gaps', order: 3 },
    { id: 'phase-8-task-1-step-4', task_id: 'phase-8-task-1', text: 'Document source of truth', order: 4 },
    // Phase 8 Task 2
    { id: 'phase-8-task-2-step-1', task_id: 'phase-8-task-2', text: 'Define STC stage criteria', order: 1 },
    { id: 'phase-8-task-2-step-2', task_id: 'phase-8-task-2', text: 'Configure workflow enrollment', order: 2 },
    { id: 'phase-8-task-2-step-3', task_id: 'phase-8-task-2', text: 'Test stage progression', order: 3 },
    { id: 'phase-8-task-2-step-4', task_id: 'phase-8-task-2', text: 'Align with retail lifecycle', order: 4 },
  ]
  const { error: sErr } = await supabase.from('roadmap_subtasks').insert(subtasks)
  if (sErr) { console.error('Subtask insert error:', sErr); return }
  console.log(`${subtasks.length} subtasks inserted.`)

  console.log('Seed complete!')
}

seed()
