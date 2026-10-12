import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { connectDB, disconnectDB } from '../server/db.js';
import app from '../server/server.js';
import { AdminUser } from '../server/models/AdminUser.js';
import { FeeCategory } from '../server/models/FeeCategory.js';
import { PaymentOrder } from '../server/models/PaymentOrder.js';
import { PaymentTransaction } from '../server/models/PaymentTransaction.js';
import { ContentItem } from '../server/models/ContentItem.js';
import { seedAdmin } from '../scripts/seedAdmin.js';
import { seedFeeCategories } from '../scripts/seedFeeCategories.js';

let server;
let baseUrl;
let adminCookie;
let adminToken;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'Admin@SET2026!';
  process.env.ENQUIRY_RECIPIENT_EMAIL = 'harsh.singh.2003dydt@gmail.com';
  await connectDB();
  await seedAdmin();
  await seedFeeCategories();
  return new Promise((resolve) => {
    // Listen on port 0 for random free port in tests
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`[Test Suite] Test server running on ${baseUrl}`);
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDB();
});

describe('1. Admin Authentication Tests', () => {
  test('Rejects access to protected endpoint without auth token/cookie', async () => {
    const res = await fetch(`${baseUrl}/api/admin/dashboard/stats`);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  test('Rejects invalid administrator credentials', async () => {
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'WrongPassword123!' })
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  test('Authenticates valid administrator and returns HTTP-only session', async () => {
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@SET2026!' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.token);
    assert.equal(data.admin.username, 'admin');

    adminToken = data.token;
    const cookieHeader = res.headers.get('set-cookie');
    if (cookieHeader) {
      adminCookie = cookieHeader.split(';')[0];
    }
  });

  test('Allows authenticated access to admin dashboard stats', async () => {
    const res = await fetch(`${baseUrl}/api/admin/dashboard/stats`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        ...(adminCookie ? { 'Cookie': adminCookie } : {})
      }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.stats);
    assert.ok(typeof data.stats.totalPublished === 'number');
    assert.ok(typeof data.stats.verifiedCollectionsRupees === 'string');
  });
});

describe('2. CMS Content Management & Privacy Tests', () => {
  let createdArticleId;

  test('Public endpoints return only published content and never drafts', async () => {
    // Create a draft article directly in DB
    const draft = await ContentItem.create({
      contentType: 'news',
      title: 'Secret Draft Article Never Public',
      slug: 'secret-draft-article',
      status: 'draft',
      institution: 'Sarveshwaree Mahavidyalaya'
    });

    const publicRes = await fetch(`${baseUrl}/api/public/news`);
    assert.equal(publicRes.status, 200);
    const publicData = await publicRes.json();
    assert.equal(publicData.success, true);

    const found = publicData.items.find(i => i.title === 'Secret Draft Article Never Public');
    assert.equal(found, undefined, 'Draft item MUST NOT appear in public API');

    // Clean up
    await ContentItem.findByIdAndDelete(draft._id);
  });

  test('Admin can create, update, and publish content', async () => {
    // 1. Create draft via Admin API
    const createRes = await fetch(`${baseUrl}/api/admin/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        contentType: 'notices',
        title: 'New Semester Notice For Students',
        noticeNumber: 'SET/2026/TEST',
        category: 'Academic',
        summary: 'Important academic notification',
        institution: 'Sarveshwaree Mahavidyalaya',
        status: 'draft'
      })
    });
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.equal(createData.success, true);
    createdArticleId = createData.item._id;

    // 2. Publish it
    const publishRes = await fetch(`${baseUrl}/api/admin/content/${createdArticleId}/publish`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(publishRes.status, 200);

    // 3. Verify it now appears on public notices
    const publicRes = await fetch(`${baseUrl}/api/public/notices?search=New%20Semester%20Notice`);
    assert.equal(publicRes.status, 200);
    const publicData = await publicRes.json();
    const publishedItem = publicData.items.find(i => i._id === createdArticleId);
    assert.ok(publishedItem, 'Published item should be visible publicly');

    // 4. Unpublish it
    const unpublishRes = await fetch(`${baseUrl}/api/admin/content/${createdArticleId}/unpublish`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(unpublishRes.status, 200);

    // 5. Verify it disappeared from public notices
    const checkRes = await fetch(`${baseUrl}/api/public/notices?search=New%20Semester%20Notice`);
    const checkData = await checkRes.json();
    const stillThere = checkData.items.find(i => i._id === createdArticleId);
    assert.equal(stillThere, undefined, 'Unpublished item must disappear from public API');

    // Cleanup
    await ContentItem.findByIdAndDelete(createdArticleId);
  });

  test('Enforces privacy authorization requirement for result publications', async () => {
    const res = await fetch(`${baseUrl}/api/admin/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        contentType: 'results',
        title: 'Unauthorized Result Publication',
        status: 'published',
        authorizedForPublicRelease: false // Missing confirmation!
      })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Privacy Compliance/i);
  });
});

describe('3. Public Fee Payment & Gateway Verification Tests', () => {
  let publishedFeeCategory;
  let createdOrderId;
  let internalReferenceId;
  let razorpayOrderId;

  test('Public can retrieve published active fee categories without logging in', async () => {
    const res = await fetch(`${baseUrl}/api/payments/options`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.categories.length >= 3);

    // Verify default required fees exist
    const dled = data.categories.find(c => c.name.includes('D.El.Ed'));
    const iti = data.categories.find(c => c.name.includes('ITI'));
    const ba = data.categories.find(c => c.name.includes('B.A.'));

    assert.ok(dled, 'D.El.Ed fee category must exist');
    assert.equal(dled.amountPaise, 4100000, 'D.El.Ed fee must be ₹41,000 (4100000 paise)');

    assert.ok(iti, 'ITI fee category must exist');
    assert.equal(iti.amountPaise, 1600000, 'ITI fee must be ₹16,000 (1600000 paise)');

    assert.ok(ba, 'B.A. fee category must exist');
    assert.equal(ba.amountPaise, 300000, 'B.A. fee must be ₹3,000 (300000 paise)');

    publishedFeeCategory = ba;
  });

  test('Server calculates fee quote and ignores any browser-supplied amount', async () => {
    const res = await fetch(`${baseUrl}/api/payments/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feeCategoryId: publishedFeeCategory.id,
        tamperedAmount: 100 // malicious client attempting to pay ₹1
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.quote.amountPaise, 300000, 'Server must return DB amount, not client-tampered amount');
  });

  test('Creates a server-side payment order with snapshot', async () => {
    const res = await fetch(`${baseUrl}/api/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feeCategoryId: publishedFeeCategory.id,
        studentDetails: {
          studentName: 'Rahul Verma',
          rollNumber: 'SM-2026-BA-0142',
          email: 'rahul.verma@example.com',
          phone: '9876543210'
        }
      })
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.orderId);
    assert.ok(data.referenceId);
    assert.ok(data.razorpayOrderId);
    assert.equal(data.amountPaise, 300000);

    createdOrderId = data.orderId;
    internalReferenceId = data.referenceId;
    razorpayOrderId = data.razorpayOrderId;
  });

  test('Rejects invalid payment signature during verification', async () => {
    const res = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpayOrderId,
        razorpayPaymentId: `pay_test_tampered_${Date.now()}`,
        razorpaySignature: 'invalid_forged_signature_hash'
      })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.verified, false);
    assert.match(data.error, /Verification Failure/i);
  });

  test('Verifies valid payment signature and marks order successful', async () => {
    const paymentId = `pay_${Date.now()}`;
    const validSignature = `test_sig_${paymentId}`;

    const res = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpayOrderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: validSignature
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.verified, true);
    assert.equal(data.referenceId, internalReferenceId);
  });

  test('Generates downloadable receipt only after successful verification', async () => {
    const res = await fetch(`${baseUrl}/api/payments/receipt/${internalReferenceId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.receipt.studentName, 'Rahul Verma');
    assert.equal(data.receipt.amountPaise, 300000);
    assert.equal(data.receipt.status, 'VERIFIED & PAID');
    assert.ok(data.receipt.verificationHash);
  });

  test('Prevents duplicate transactions from repeated webhooks', async () => {
    const webhookPayload = JSON.stringify({
      id: `evt_test_${Date.now()}`,
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_webhook_${Date.now()}`,
            order_id: razorpayOrderId,
            amount: 300000
          }
        }
      }
    });

    const res1 = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'valid_test_webhook_sig'
      },
      body: webhookPayload
    });
    assert.equal(res1.status, 200);

    // Repeated delivery of exact same webhook event
    const res2 = await fetch(`${baseUrl}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'valid_test_webhook_sig'
      },
      body: webhookPayload
    });
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.match(data2.message, /already processed/i);
  });
});

describe('4. UPI QR Manual Payment & Verification Desk Tests', () => {
  let submittedRefId;
  let submissionOrderId;
  let targetFeeCategory;

  test('Public student can retrieve institutional QR code and UPI details', async () => {
    const res = await fetch(`${baseUrl}/api/payments/qr-config`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.settings.qrImageUrl);
    assert.equal(data.settings.upiId, 'shobhaeducationtrust@upi');
  });

  test('Student can submit UPI payment proof with 12-digit UTR', async () => {
    // Find active D.El.Ed category
    const dledFee = await FeeCategory.findOne({ name: /D.El.Ed/i, status: 'published' });
    assert.ok(dledFee);
    targetFeeCategory = dledFee;

    const res = await fetch(`${baseUrl}/api/payments/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feeCategoryId: targetFeeCategory._id,
        studentDetails: {
          studentName: 'Pooja Tiwari',
          rollNumber: 'SM-2026-DLED-0034',
          email: 'pooja.tiwari@example.com',
          phone: '9876543211',
          notes: 'Year 1 Annual Tuition'
        },
        utrNumber: '428910293812',
        paymentDate: new Date()
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.referenceId);
    assert.match(data.referenceId, /^SET-PAY-/);
    submittedRefId = data.referenceId;
  });

  test('Payment record starts in pending status and blocks receipt issuance', async () => {
    const statusRes = await fetch(`${baseUrl}/api/payments/status/${submittedRefId}`);
    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.equal(statusData.order.status, 'pending');
    submissionOrderId = statusData.order.orderId;

    // Receipt should be refused while pending
    const rcptRes = await fetch(`${baseUrl}/api/payments/receipt/${submittedRefId}`);
    assert.equal(rcptRes.status, 400);
    const rcptData = await rcptRes.json();
    assert.match(rcptData.error, /verification/i);
  });

  test('Admin can view submission queue and manually verify/approve payment', async () => {
    // 1. Admin lists payments
    const listRes = await fetch(`${baseUrl}/api/admin/payments?search=${submittedRefId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    const sub = listData.submissions.find(s => s.referenceId === submittedRefId);
    assert.ok(sub);
    assert.equal(sub.status, 'pending');

    // 2. Admin manually approves
    const verifyRes = await fetch(`${baseUrl}/api/admin/payments/${sub._id}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        adminNotes: 'Confirmed credit in SBI Bank Account ledger for ₹41,000.'
      })
    });
    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.success, true);
    assert.equal(verifyData.order.status, 'verified');
  });

  test('Verified payment now produces official receipt with cryptographic hash', async () => {
    const rcptRes = await fetch(`${baseUrl}/api/payments/receipt/${submittedRefId}`);
    assert.equal(rcptRes.status, 200);
    const rcptData = await rcptRes.json();
    assert.equal(rcptData.success, true);
    assert.equal(rcptData.receipt.studentName, 'Pooja Tiwari');
    assert.equal(rcptData.receipt.amountPaise, 4100000);
    assert.equal(rcptData.receipt.utrNumber, '428910293812');
    assert.equal(rcptData.receipt.status, 'VERIFIED & PAID');
    assert.ok(rcptData.receipt.verificationHash);
  });

  test('Admin can update QR code image and UPI bank settings', async () => {
    const res = await fetch(`${baseUrl}/api/admin/payments/qr-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        qrImageUrl: '/assets/qr.png',
        upiId: 'shobhaeducationtrust@sbi',
        accountName: 'Shobha Education Trust',
        instructions: 'Scan using any UPI app and submit your 12-digit UTR.'
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.settings.upiId, 'shobhaeducationtrust@sbi');
  });
});

describe('5. Admission Enquiry, Unified News & Events, and Course Price Sync Tests', () => {
  test('Public enquiry creates structured email template and mailto link', async () => {
    const res = await fetch(`${baseUrl}/api/public/enquiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Vikas Maurya',
        phone: '9876543210',
        district: 'Jaunpur',
        email: 'vikas@example.com',
        programme: 'D.El.Ed (BTC)',
        message: 'Requesting prospectus.'
      })
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.emailTemplate);
    assert.ok(data.emailTemplate.body.includes('Vikas Maurya'));
    assert.ok(data.emailTemplate.mailtoUrl.startsWith('mailto:'));
  });

  test('Unified news-and-events returns published circulars across news, notices, and events', async () => {
    const res = await fetch(`${baseUrl}/api/public/news-and-events`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.items));
  });

  test('Admin can update course prices and synchronize with fee category models', async () => {
    const res = await fetch(`${baseUrl}/api/admin/payments/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        qrImageUrl: '/assets/qr.png',
        upiId: 'shobhaeducationtrust@upi',
        accountName: 'Shobha Education Trust',
        deledPriceRupees: 42000,
        itiPriceRupees: 17000,
        baPriceRupees: 3500
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.settings.coursePrices.deledPriceRupees, 42000);

    // Verify /api/payments/options returns updated prices
    const optRes = await fetch(`${baseUrl}/api/payments/options`);
    const optData = await optRes.json();
    assert.equal(optRes.status, 200);
    const deledCat = optData.categories.find(c => c.name.includes('D.El.Ed'));
    assert.ok(deledCat);
    assert.equal(deledCat.amountPaise, 4200000);
  });

  test('Admin can disapprove payment submission with recorded feedback reason', async () => {
    // 1. Submit a payment to reject
    const optRes = await fetch(`${baseUrl}/api/payments/options`);
    const optData = await optRes.json();
    const deledCat = optData.categories.find(c => c.name.includes('D.El.Ed'));
    const submitRes = await fetch(`${baseUrl}/api/payments/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feeCategoryId: deledCat.id,
        studentDetails: {
          studentName: 'Candidate To Disapprove',
          district: 'Jaunpur',
          phone: '9999988888',
          email: 'disapproved@example.com'
        },
        utrNumber: '000000000000',
        paymentDate: '2026-10-12'
      })
    });
    assert.equal(submitRes.status, 201);
    const submitData = await submitRes.json();
    const orderId = submitData.orderId;

    // 2. Disapprove payment
    const rejectRes = await fetch(`${baseUrl}/api/admin/payments/${orderId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        rejectionReason: 'Invalid transaction UTR reference.'
      })
    });
    assert.equal(rejectRes.status, 200);
    const rejectData = await rejectRes.json();
    assert.equal(rejectData.success, true);
    assert.equal(rejectData.order.status, 'rejected');
    assert.equal(rejectData.order.rejectionDetails.rejectionReason, 'Invalid transaction UTR reference.');
  });
});

describe('6. Production Mail Enquiry System Tests', () => {
  let createdReferenceId = null;

  test('Accepts valid enquiry submission with full fields and dispatches email', async () => {
    const res = await fetch(`${baseUrl}/api/v1/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rohit Sharma',
        email: 'rohit.sharma@example.com',
        phone: '9876543210',
        category: 'Admissions',
        institutionOrProgramme: 'Sarveshwaree Mahavidyalaya (B.A.)',
        subject: 'Course Curriculum & Admission Eligibility 2026-27',
        message: 'Kindly provide the detailed fee schedule and seat intake for BA programme.'
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.referenceId);
    assert.match(data.referenceId, /^SET-ENQ-/);
    assert.equal(data.deliveryStatus, 'delivered');
    assert.equal(data.recipient, process.env.ENQUIRY_RECIPIENT_EMAIL || 'harsh.singh.2003dydt@gmail.com');
    createdReferenceId = data.referenceId;
  });

  test('Rejects enquiry missing required full name', async () => {
    const res = await fetch(`${baseUrl}/api/v1/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '   ',
        email: 'test@example.com',
        phone: '9876543210',
        category: 'General Enquiry',
        subject: 'General Question',
        message: 'This is a test message.'
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /Full Name/i);
  });

  test('Rejects enquiry with malformed email address', async () => {
    const res = await fetch(`${baseUrl}/api/v1/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aakash Verma',
        email: 'not-an-email-at-all',
        phone: '9876543210',
        category: 'General Enquiry',
        subject: 'Verification Query',
        message: 'Checking degree verification process.'
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /valid email address/i);
  });

  test('Rejects enquiry with invalid mobile number (less than 10 digits)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pooja Yadav',
        email: 'pooja@example.com',
        phone: '12345',
        category: 'Fee Enquiry',
        subject: 'Hostel Fee',
        message: 'Inquiring about hostel accommodation fee.'
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /mobile number/i);
  });

  test('Rejects enquiry with category not in allowed list', async () => {
    const res = await fetch(`${baseUrl}/api/v1/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Suresh Kumar',
        email: 'suresh@example.com',
        phone: '9876543210',
        category: 'SpamOrInvalidCategory123',
        subject: 'Invalid Category Subject',
        message: 'This message has an unauthorized category.'
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /Must be one of/i);
  });

  test('Rejects message exceeding 3,000 characters', async () => {
    const longMessage = 'A'.repeat(3050);
    const res = await fetch(`${baseUrl}/api/v1/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Deepak Patel',
        email: 'deepak@example.com',
        phone: '9876543210',
        category: 'Other',
        subject: 'Excessive Length Test',
        message: longMessage
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /cannot exceed 3,000 characters/i);
  });

  test('Spam Honeypot: rejects bot submissions with honeypot field filled', async () => {
    const res = await fetch(`${baseUrl}/api/v1/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _hp_address: 'http://spambot-url.com',
        name: 'Spam Bot',
        email: 'bot@spam.com',
        phone: '9876543210',
        category: 'General Enquiry',
        subject: 'Spam Subject',
        message: 'Spam content advertisement message.'
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.error, 'Spam submission detected.');
  });

  test('Handles email delivery provider failure gracefully without exposing internals', async () => {
    process.env.MOCK_EMAIL_FAILURE = 'true';
    try {
      const res = await fetch(`${baseUrl}/api/v1/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Anjali Gupta',
          email: 'anjali@example.com',
          phone: '9876543210',
          category: 'Courses and Eligibility',
          subject: 'Eligibility for D.El.Ed',
          message: 'Can I apply for D.El.Ed with a graduation percentage of 52%?'
        })
      });

      assert.equal(res.status, 502);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.referenceId);
      assert.match(data.error, /campus helpline/i);
      // Ensures internal errors or stack traces are not leaked
      assert.equal(data.stack, undefined);
    } finally {
      delete process.env.MOCK_EMAIL_FAILURE;
    }
  });

  test('Enquiry record is persisted in MongoDB with correct attributes', async () => {
    assert.ok(createdReferenceId);
    const { Enquiry } = await import('../server/models/Enquiry.js');
    const doc = await Enquiry.findOne({ referenceId: createdReferenceId });
    assert.ok(doc);
    assert.equal(doc.name, 'Rohit Sharma');
    assert.equal(doc.email, 'rohit.sharma@example.com');
    assert.equal(doc.category, 'Admissions');
    assert.equal(doc.deliveryStatus, 'delivered');
  });

  test('Alias route /api/public/enquiries behaves identically', async () => {
    const res = await fetch(`${baseUrl}/api/public/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mohit Singh',
        email: 'mohit@example.com',
        phone: '9876543210',
        category: 'Campus and Facilities',
        subject: 'Hostel and Library Timings',
        message: 'Inquiring about central library timings and girls hostel facilities.'
      })
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.referenceId);
  });

  test('CORS headers allow requests from configured frontend origins', async () => {
    const res = await fetch(`${baseUrl}/api/v1/enquiries`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  });
});



