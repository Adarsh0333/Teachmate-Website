const db = require('./db');

async function addSampleEmails() {
    try {
        console.log('Adding pre-approved emails to the database...');

        const emails = [
            ['student.one@college.edu', 'student'],
            ['teacher.one@college.edu', 'teacher']
        ];

        // Loop through the emails and insert them one by one, ignoring duplicates
        for (const [email, role] of emails) {
            try {
                await db.query('INSERT INTO PreApprovedMails (email, role) VALUES (?, ?)', [email, role]);
                console.log(`Added: ${email}`);
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    console.log(`Skipped: ${email} (already exists)`);
                } else {
                    // If it's another error, we should stop and see it
                    throw error;
                }
            }
        }

        console.log('Sample emails added successfully! ✅');

    } catch (error) {
        console.error('Error adding sample emails:', error);
    } finally {
        // End the database connection
        db.end();
    }
}

addSampleEmails();