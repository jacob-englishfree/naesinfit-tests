const { createClient } = require('@supabase/supabase-js');

const NF_URL = "https://enkewpvhaugcmyglifkc.supabase.co";
const NF_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVua2V3cHZoYXVnY215Z2xpZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTQzMjksImV4cCI6MjA4OTA3MDMyOX0.JJvDYNbxSnsaE30tMFl5x1Daqyx2Wk8bQv6s19tNrY8";

const client = createClient(NF_URL, NF_KEY);

async function queryDatabase() {
  try {
    // Get all students
    const { data: students, error: studentsError } = await client
      .from('students')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
      return;
    }

    console.log(`\nTotal active students: ${students.length}\n`);

    // Get selections for each student
    const { data: selections, error: selectionsError } = await client
      .from('selections')
      .select('*')
      .order('exam_date', { ascending: true });

    if (selectionsError) {
      console.error('Error fetching selections:', selectionsError);
      return;
    }

    console.log(`Total selections: ${selections.length}\n`);

    // Create a map of student_id -> selections
    const selectionMap = {};
    selections.forEach(sel => {
      if (!selectionMap[sel.student_id]) {
        selectionMap[sel.student_id] = [];
      }
      selectionMap[sel.student_id].push(sel);
    });

    // Create result table
    const results = [];
    students.forEach(student => {
      const studentSelections = selectionMap[student.id] || [];
      
      // Filter for textbook only (exclude 부교재/모의고사)
      const textbookSelections = studentSelections.filter(sel => 
        sel.textbook && !sel.textbook.includes('부교재') && !sel.textbook.includes('모의고사')
      );

      if (textbookSelections.length > 0) {
        textbookSelections.forEach(sel => {
          results.push({
            name: student.name,
            phone: student.phone || '-',
            textbook: sel.textbook || '-',
            scope: sel.scope || '-',
            exam_date: sel.exam_date || '-',
            status: student.status
          });
        });
      }
    });

    // Sort by exam_date
    results.sort((a, b) => {
      if (a.exam_date === '-') return 1;
      if (b.exam_date === '-') return -1;
      return new Date(a.exam_date) - new Date(b.exam_date);
    });

    // Print table
    console.log('='.repeat(130));
    console.log('NaesinFit Student Exam Data - 교과서(Textbook) Only');
    console.log('='.repeat(130));
    console.log(
      'Student Name'.padEnd(15) +
      'Phone'.padEnd(15) +
      'Textbook (교과서)'.padEnd(35) +
      'Exam Scope (시험 범위)'.padEnd(35) +
      'Exam Date'.padEnd(15) +
      'Status'.padEnd(15)
    );
    console.log('-'.repeat(130));

    results.forEach(row => {
      console.log(
        (row.name || '-').padEnd(15) +
        (row.phone || '-').padEnd(15) +
        (row.textbook || '-').substring(0, 34).padEnd(35) +
        (row.scope || '-').substring(0, 34).padEnd(35) +
        (row.exam_date || '-').padEnd(15) +
        (row.status || '-').padEnd(15)
      );
    });

    console.log('='.repeat(130));
    console.log(`Total textbook exam records: ${results.length}`);
    console.log(`Total unique students with textbook exams: ${new Set(results.map(r => r.name)).size}`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

queryDatabase();
