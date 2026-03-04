import { jsPDF } from 'jspdf';

/**
 * Generates a comprehensive PDF documenting the Hazina Care Fund workflows.
 */
export const generateWorkflowPDF = async () => {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
    });

    const BRAND_PRIMARY = '#10b981';
    const BRAND_SECONDARY = '#064e3b';
    const TEXT_DARK = '#1e293b';
    const TEXT_LIGHT = '#64748b';

    // --- Cover Page ---
    doc.setFillColor(BRAND_SECONDARY);
    doc.rect(0, 0, 210, 297, 'F');

    // Design elements
    doc.setDrawColor(BRAND_PRIMARY);
    doc.setLineWidth(2);
    doc.line(20, 40, 60, 40);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(36);
    doc.text('HAZINA', 20, 65);
    doc.setTextColor(BRAND_PRIMARY);
    doc.text('CARE FUND', 20, 80);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('System Architecture & Workflows', 20, 100);

    doc.setLineWidth(0.5);
    doc.setDrawColor(255, 255, 255, 0.2);
    doc.line(20, 115, 190, 115);

    doc.setFontSize(10);
    doc.text('Version 1.0.0 | MVP Roadmap Document', 20, 125);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 132);

    // --- Page 2: Table of Contents ---
    doc.addPage();
    doc.setTextColor(TEXT_DARK);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Functional Workflows', 20, 40);

    doc.setDrawColor(BRAND_PRIMARY);
    doc.setLineWidth(1);
    doc.line(20, 45, 40, 45);

    const sections = [
        { title: '1. Authentication & Onboarding', page: 3 },
        { title: '2. Wallet & Financial Flow', page: 4 },
        { title: '3. Claims Management', page: 5 },
        { title: '4. Dependent Protection', page: 6 },
        { title: '5. Admin Oversight', page: 7 }
    ];

    let y = 65;
    sections.forEach(s => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(s.title, 20, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(TEXT_LIGHT);
        doc.text('.......................................................................................', 90, y);
        doc.setTextColor(TEXT_DARK);
        doc.text(`Page 0${s.page}`, 180, y);
        y += 15;
    });

    // --- Page 3: Authentication & Onboarding ---
    doc.addPage();
    drawPageHeader(doc, '01', 'Authentication & Onboarding');

    y = 60;
    drawStep(doc, y, 'Step 1: App Entry', 'User joins via Phone Number & OTP verification.');
    y += 25;
    drawStep(doc, y, 'Step 2: Tier Selection', 'Bronze (KSh 10/day), Silver (KSh 30/day), Gold (KSh 50/day).');
    y += 25;
    drawStep(doc, y, 'Step 3: Initial Fees', 'Payment of setup fees via M-Pesa STK push.');
    y += 25;
    drawStep(doc, y, 'Step 4: Grace Period', 'Automatic 180-day maturation period starts.');

    // --- Page 4: Wallet & Financial ---
    doc.addPage();
    drawPageHeader(doc, '02', 'Wallet & Financial Flow');

    y = 60;
    drawStep(doc, y, 'Balance Tracking', 'Real-time Firestore sync with M-Pesa B2C/C2B hooks.');
    y += 25;
    drawStep(doc, y, 'Daily Burn', 'Automated daily deduction based on active tier.');
    y += 25;
    drawStep(doc, y, 'Top-Up Logic', 'Dynamic STK push allows instant wallet replenishment.');
    y += 25;
    drawStep(doc, y, 'Tier Upgrades', 'Prorated transition to higher protection limits.');

    // --- Page 5: Claims Management ---
    doc.addPage();
    drawPageHeader(doc, '03', 'Claims Management');

    y = 60;
    drawStep(doc, y, 'Submission', 'User provides evidence for Medical, Bereavement, or School Fees.');
    y += 25;
    drawStep(doc, y, 'Committee Review', 'Admin Panel handles approval/rejection queue.');
    y += 25;
    drawStep(doc, y, 'Disbursement', 'Automated B2C payout to user phone number upon approval.');
    y += 25;
    drawStep(doc, y, 'Safety Guards', 'Checks for maturation (grace period) and tier limits.');

    // --- Page 6: Dependent Protection ---
    doc.addPage();
    drawPageHeader(doc, '04', 'Dependent Protection');

    y = 60;
    drawStep(doc, y, 'Addition', 'Guardian adds family members (Name, Relation, Tier).');
    y += 25;
    drawStep(doc, y, 'Premiums', 'Individual burn rates for each added dependent.');
    y += 25;
    drawStep(doc, y, 'Maturation', 'Independent maturation tracking for each family member.');

    // --- Page 7: Admin Oversight ---
    doc.addPage();
    drawPageHeader(doc, '05', 'Admin Oversight');

    y = 60;
    drawStep(doc, y, 'Claims Verification', 'Review evidence, verify maturity, and approve payouts.');
    y += 25;
    drawStep(doc, y, 'User Management', 'Monitor membership growth and toggle administrative roles.');
    y += 25;
    drawStep(doc, y, 'System Analytics', 'Track total fund liquidity and active shield distributions.');

    // --- Footer on all pages ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 2; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Hazina Care Fund Workflow Document | Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
    }

    // Save the PDF
    doc.save('Hazina_System_Workflow.pdf');
};

// Helper to draw headers
const drawPageHeader = (doc, number, title) => {
    doc.setTextColor('#10b981');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`SECTION ${number}`, 20, 20);

    doc.setTextColor('#1e293b');
    doc.setFontSize(24);
    doc.text(title, 20, 32);

    doc.setDrawColor('#10b981');
    doc.setLineWidth(1);
    doc.line(20, 38, 50, 38);
};

// Helper to draw workflow steps
const drawStep = (doc, y, title, desc) => {
    doc.setFillColor('#f8fafc');
    doc.setDrawColor('#e2e8f0');
    doc.roundedRect(20, y, 170, 20, 3, 3, 'FD');

    doc.setTextColor('#1e293b');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 28, y + 8);

    doc.setTextColor('#64748b');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(desc, 28, y + 14);
};
