import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import { allBlogPosts } from "./src/data/blogPosts";
import { serverResources as resources } from "./src/data/serverResources";
import { assertPrivateDownloadAvailable, createSignedDownloadUrl, getFirestoreDocument, getPaidOrderEmailStatus, isPaidOrderStoreConfigured, patchFirestoreDocument, persistPaidOrder, updatePaidOrderEmailStatus, verifyFirebaseIdToken } from "./src/server/paidOrderStore";
import { isResourceEmailConfigured, sendAppointmentRequestNotification, sendAppointmentStatusNotification, sendPaidResourceEmail } from "./src/server/resourceEmail";
import { deleteClinicCalendarEvent, getClinicTimezone, isClinicCalendarConfigured, upsertClinicCalendarEvent } from "./src/server/clinicCalendar";
import path from "path";
import Razorpay from "razorpay";
import crypto from "crypto";

// Initialize Razorpay lazily to avoid crash if keys are missing
let razorpayInstance: Razorpay | null = null;

function getRazorpay() {
  if (!razorpayInstance) {
    const keyId = process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    
    if (!keyId || !keySecret) {
      console.warn("Razorpay API keys are missing. Payment features will be disabled.");
      return null;
    }
    
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayInstance;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isServerlessRuntime = Boolean(
    process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
  );

  // Netlify forwards the visitor address through X-Forwarded-For. Trust only
  // the platform proxy hop so IP-based API limits key on the visitor, not the
  // shared function runtime.
  if (process.env.NETLIFY) {
    app.set('trust proxy', 1);
  }

  // Database setup (Pure JS In-Memory representation)
  // Helper to generate slug
  const generateSlug = (title: string, id: string) => {
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    return `${slug}-${id.substring(0, 5)}`;
  };

  // Helper to estimate reading time
  const estimateReadingTime = (content: string) => {
    const wordsPerMinute = 200;
    const words = content.split(/\s+/).length;
    return `${Math.max(1, Math.ceil(words / wordsPerMinute))} min read`;
  };

  const postsDb: any[] = allBlogPosts.map(post => {
    const slug = (post as any).slug || generateSlug(post.title, post.id);
    return {
      id: post.id,
      slug: slug,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      author: post.author,
      date: post.date,
      category: post.category,
      image: post.image,
      tags: post.tags || [],
      readingTime: estimateReadingTime(post.content),
      seoTitle: post.seoTitle || null,
      quickSummary: (post as any).quickSummary || [],
      keyPatterns: (post as any).keyPatterns || [],
      whoItSuits: (post as any).whoItSuits || null,
      whenToConsider: (post as any).whenToConsider || [],
      modalities: (post as any).modalities || { better: [], worse: [] },
      comparisons: (post as any).comparisons || [],
      relatedCarePlans: (post as any).relatedCarePlans || [],
      citations: (post as any).citations || [],
      relatedRemedies: (post as any).relatedRemedies || [],
      relatedConditions: (post as any).relatedConditions || []
    };
  });

  console.log("Database seeded with", postsDb.length, "posts in-memory.");

  app.use(express.json({
    limit: "128kb",
    verify: (req: any, _res, buffer: Buffer) => {
      // Preserve exact bytes only for Razorpay's signed webhook. Request bodies
      // for ordinary API calls are not duplicated into req.rawBody.
      const requestPath = String(req.originalUrl || req.url || "").split("?")[0];
      const requestSegments = requestPath.split("/").filter(Boolean);
      if (requestSegments[requestSegments.length - 1] === "razorpay-webhook") {
        req.rawBody = Buffer.from(buffer);
      }
    },
  }));

  // API responses can contain account, appointment or order data.
  // They must never be stored by browsers, service workers, or shared proxies.
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });
  
  async function emailPaidResourceIfConfigured(order: any, payment: any, resource: any, orderOwnerId: string, userEmail: string): Promise<'sent' | 'not-configured' | 'failed' | 'expired'> {
    if (!isResourceEmailConfigured()) return 'not-configured';

    const existingStatus = await getPaidOrderEmailStatus(order.id).catch(() => undefined);
    if (existingStatus === 'sent') return 'sent';

    const createdAt = typeof order.created_at === 'number' ? new Date(order.created_at * 1000) : new Date();
    const emailExpirySeconds = 24 * 60 * 60;
    try {
      // Anchor the email URL to the Razorpay order creation time so webhook retries
      // generate the same payload and Resend can safely deduplicate them.
      const emailDownloadUrl = createSignedDownloadUrl(resource.storageObject, emailExpirySeconds, createdAt);
      await sendPaidResourceEmail({
        orderId: order.id,
        to: userEmail,
        resourceTitle: resource.title,
        downloadUrl: emailDownloadUrl,
        amount: Number(payment.amount),
        currency: payment.currency,
      });
      await updatePaidOrderEmailStatus(order.id, 'sent');
      return 'sent';
    } catch (emailError: any) {
      const expired = String(emailError?.message || '').includes('expired');
      console.error('Paid resource email delivery failed:', emailError?.name || 'ProviderError');
      await updatePaidOrderEmailStatus(order.id, expired ? 'expired' : 'failed').catch((statusError) => {
        console.error('Unable to persist resource email status:', statusError?.name || 'StorageError');
      });
      return expired ? 'expired' : 'failed';
    }
  }

  function firestoreField(document: any, fieldName: string): any {
    const field = document?.fields?.[fieldName];
    if (!field) return undefined;
    if ('stringValue' in field) return field.stringValue;
    if ('timestampValue' in field) return field.timestampValue;
    if ('integerValue' in field) return Number(field.integerValue);
    return undefined;
  }

  function appointmentRecord(document: any, requestId: string) {
    if (!document) return null;
    return {
      id: requestId,
      updateTime: document.updateTime,
      userId: firestoreField(document, 'userId'),
      userEmail: firestoreField(document, 'userEmail'),
      displayName: firestoreField(document, 'displayName') || '',
      phoneNumber: firestoreField(document, 'phoneNumber') || '',
      serviceType: firestoreField(document, 'serviceType') || 'general-consultation',
      preferredDate: firestoreField(document, 'preferredDate') || '',
      preferredTime: firestoreField(document, 'preferredTime') || '',
      timezone: firestoreField(document, 'timezone') || 'UTC',
      status: firestoreField(document, 'status') || 'requested',
      adminResponse: firestoreField(document, 'adminResponse') || '',
      confirmedDateTime: firestoreField(document, 'confirmedDateTime') || '',
      confirmedTimeZone: firestoreField(document, 'confirmedTimeZone') || '',
      calendarEventId: firestoreField(document, 'calendarEventId') || '',
    };
  }

  function appointmentAdminUids(): string[] {
    return (process.env.CURIVA_APPOINTMENT_ADMIN_UIDS || '').split(',').map((value) => value.trim()).filter(Boolean);
  }

  app.get('/api/appointments/config', (_req, res) => {
    res.json({
      calendarConfigured: isClinicCalendarConfigured() && isPaidOrderStoreConfigured(),
      clinicTimezone: getClinicTimezone(),
      notificationsConfigured: Boolean(process.env.CURIVA_APPOINTMENT_NOTIFICATION_EMAIL?.trim() && isResourceEmailConfigured()),
    });
  });

  const appointmentNotifyRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many appointment notification attempts. Please try again later.' },
  });

  const appointmentAdminUpdateRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many appointment review attempts. Please try again later.' },
  });

  app.post('/api/appointments/notify-request', appointmentNotifyRateLimiter, async (req, res) => {
    const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Sign in to notify the clinic about an appointment request.' });
    }
    let identity: { uid: string; email: string | null; emailVerified: boolean };
    try {
      identity = await verifyFirebaseIdToken(authorization.slice(7).trim());
    } catch {
      return res.status(401).json({ success: false, error: 'Your Curiva account session could not be verified.' });
    }
    if (!identity.emailVerified) {
      return res.status(403).json({ success: false, error: 'Verify your account email before sending a clinic notification.' });
    }
    const requestId = typeof req.body?.requestId === 'string' ? req.body.requestId : '';
    if (!requestId || requestId.length > 128 || requestId.includes('/')) {
      return res.status(400).json({ success: false, error: 'A valid appointment request ID is required.' });
    }
    const clinicEmail = process.env.CURIVA_APPOINTMENT_NOTIFICATION_EMAIL?.trim();
    if (!clinicEmail || !isResourceEmailConfigured()) {
      return res.status(503).json({ success: false, notification: 'not-configured', error: 'Clinic request email notifications are not configured.' });
    }
    try {
      const document = await getFirestoreDocument('appointmentRequests', requestId);
      const request = appointmentRecord(document, requestId);
      if (!request) return res.status(404).json({ success: false, error: 'Appointment request was not found.' });
      if (request.userId !== identity.uid) return res.status(403).json({ success: false, error: 'You can notify the clinic only about your own request.' });
      if (request.status !== 'requested') return res.status(409).json({ success: false, error: 'Only a pending request can be notified.' });
      await sendAppointmentRequestNotification({
        requestId,
        to: clinicEmail,
        requesterName: request.displayName,
        requesterEmail: request.userEmail || identity.email || '',
        phoneNumber: request.phoneNumber,
        serviceType: request.serviceType,
        preferredDate: request.preferredDate,
        preferredTime: request.preferredTime,
        timezone: request.timezone,
      });
      return res.status(200).json({ success: true, notification: 'sent' });
    } catch (error: any) {
      console.error('Appointment request notification failed:', error?.name || 'ProviderError');
      return res.status(502).json({ success: false, notification: 'failed', error: 'Your request is saved, but the clinic email notification failed.' });
    }
  });

  app.post('/api/appointments/admin-update', appointmentAdminUpdateRateLimiter, async (req, res) => {
    const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Sign in as a clinic administrator to update requests.' });
    }
    let identity: { uid: string; email: string | null; emailVerified: boolean };
    try {
      identity = await verifyFirebaseIdToken(authorization.slice(7).trim());
    } catch {
      return res.status(401).json({ success: false, error: 'Your Curiva account session could not be verified.' });
    }
    if (!identity.emailVerified || !appointmentAdminUids().includes(identity.uid)) {
      return res.status(403).json({ success: false, error: 'This account is not configured as an appointment administrator.' });
    }

    const requestId = typeof req.body?.requestId === 'string' ? req.body.requestId : '';
    const status = req.body?.status;
    const adminResponse = typeof req.body?.adminResponse === 'string' ? req.body.adminResponse.trim().slice(0, 500) : '';
    const confirmedDateTime = typeof req.body?.confirmedDateTime === 'string' ? req.body.confirmedDateTime : '';
    if (!requestId || requestId.length > 128 || requestId.includes('/') || !['requested', 'confirmed', 'declined', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid appointment review request.' });
    }

    try {
      const document = await getFirestoreDocument('appointmentRequests', requestId);
      const request = appointmentRecord(document, requestId);
      if (!request) return res.status(404).json({ success: false, error: 'Appointment request was not found.' });
      if (!request.userEmail) return res.status(400).json({ success: false, error: 'The requester needs an account email before this request can be confirmed.' });
      if (status === 'confirmed' && !isClinicCalendarConfigured()) {
        return res.status(503).json({ success: false, error: 'Clinic confirmation is disabled until the Google Calendar, clinic time zone, and administrator UID list are configured.' });
      }

      let eventId = request.calendarEventId || '';
      let clinicTimezone = request.confirmedTimeZone || '';
      let confirmedTime = request.confirmedDateTime || '';
      let rollbackCalendar: (() => Promise<void>) | null = null;

      if (status === 'confirmed') {
        if (!confirmedDateTime) {
          return res.status(400).json({ success: false, error: 'Enter the actual clinic date and time before confirming.' });
        }
        const event = await upsertClinicCalendarEvent(request, confirmedDateTime, adminResponse);
        eventId = event.id;
        clinicTimezone = event.timeZone;
        confirmedTime = confirmedDateTime;
        if (request.status === 'confirmed' && request.confirmedDateTime) {
          rollbackCalendar = async () => { await upsertClinicCalendarEvent(request, request.confirmedDateTime!, request.adminResponse || ''); };
        } else {
          rollbackCalendar = () => deleteClinicCalendarEvent(request.id, event.id);
        }
      } else if (request.calendarEventId) {
        await deleteClinicCalendarEvent(request.id, request.calendarEventId);
        rollbackCalendar = async () => { await upsertClinicCalendarEvent(request, request.confirmedDateTime || confirmedDateTime, request.adminResponse || ''); };
        eventId = '';
        clinicTimezone = '';
        confirmedTime = '';
      }

      const fields: Record<string, any> = {
        status: { stringValue: status },
        adminResponse: { stringValue: adminResponse },
        updatedAt: { timestampValue: new Date().toISOString() },
      };
      const updateMask = ['status', 'adminResponse', 'updatedAt'];
      const deleteMask: string[] = [];
      if (status === 'confirmed') {
        fields.calendarEventId = { stringValue: eventId };
        fields.confirmedDateTime = { stringValue: confirmedTime };
        fields.confirmedTimeZone = { stringValue: clinicTimezone };
        updateMask.push('calendarEventId', 'confirmedDateTime', 'confirmedTimeZone');
      } else {
        deleteMask.push('calendarEventId', 'confirmedDateTime', 'confirmedTimeZone');
      }

      try {
        await patchFirestoreDocument('appointmentRequests', requestId, fields, updateMask, deleteMask, request.updateTime);
      } catch (writeError) {
        if (rollbackCalendar) {
          try {
            await rollbackCalendar();
          } catch (rollbackError: any) {
            console.error('Calendar rollback failed and requires manual reconciliation:', rollbackError?.name || 'CalendarError');
          }
        }
        throw writeError;
      }

      let emailDelivery: 'sent' | 'not-configured' | 'failed' = 'not-configured';
      if (isResourceEmailConfigured()) {
        try {
          await sendAppointmentStatusNotification({
            requestId,
            to: request.userEmail,
            requesterName: request.displayName,
            status,
            adminResponse,
            confirmedDateTime: status === 'confirmed' ? confirmedTime : undefined,
            confirmedTimeZone: status === 'confirmed' ? clinicTimezone : undefined,
          });
          emailDelivery = 'sent';
        } catch (emailError: any) {
          console.error('Appointment status email failed:', emailError?.name || 'ProviderError');
          emailDelivery = 'failed';
        }
      }
      return res.json({
        success: true,
        status,
        calendarEventId: status === 'confirmed' ? eventId : null,
        calendarTimezone: status === 'confirmed' ? clinicTimezone : null,
        emailDelivery,
      });
    } catch (error: any) {
      console.error('Appointment review update failed:', error?.name || 'StorageError');
      const errorMessage = String(error?.message || '');
      const conflict = errorMessage.includes('HTTP 409') ||
        errorMessage.includes('HTTP 412') ||
        errorMessage.includes('overlaps an existing clinic calendar event');
      return res.status(conflict ? 409 : 503).json({
        success: false,
        error: conflict ? 'Another administrator changed this request; refresh before trying again.' : error?.message || 'The request could not be updated safely.',
      });
    }
  });

  // Resource email delivery is intentionally unavailable until a real provider is configured.
  // Never report a successful delivery when the server has not sent an email.
  app.post("/api/send-resource-email", (_req, res) => {
    res.status(503).json({
      success: false,
      error: "Resource email delivery is not configured yet. Please contact Curiva support for access."
    });
  });

  const createRazorpayOrderLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many order creation attempts. Please try again later." },
  });

  // Razorpay Order Creation
  // Prices and currency are derived from the server-side catalogue; never trust client-supplied amounts.
  app.post("/api/create-razorpay-order", createRazorpayOrderLimiter, async (req, res) => {
    const resourceId = typeof req.body?.resourceId === "string" ? req.body.resourceId : "";
    const customerEmail = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const authorization = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
    let verifiedOrderUser: { uid: string; email: string | null; emailVerified: boolean } | null = null;
    if (authorization.startsWith("Bearer ")) {
      try {
        verifiedOrderUser = await verifyFirebaseIdToken(authorization.slice(7).trim());
      } catch {
        return res.status(401).json({ error: "Your account session could not be verified. Sign in again before checkout." });
      }
      if (!verifiedOrderUser.emailVerified) {
        return res.status(403).json({ error: "Verify your account email before placing an account-linked order. Guest checkout remains available." });
      }
    }
    const emailParts = customerEmail.split("@");
    const emailDomain = emailParts[1] || "";
    const hasWhitespace = [...customerEmail].some((character) => character.charCodeAt(0) <= 32);
    if (
      customerEmail.length > 200 ||
      emailParts.length !== 2 ||
      !emailParts[0] ||
      !emailDomain.includes(".") ||
      emailDomain.startsWith(".") ||
      emailDomain.endsWith(".") ||
      hasWhitespace
    ) {
      return res.status(400).json({ error: "Enter a valid email address before creating an order." });
    }
    const resource = resources.find((item) => item.id === resourceId);

    if (!resource) {
      return res.status(400).json({ error: "Choose a valid resource before creating an order." });
    }
    if (typeof resource.storageObject !== "string" || !resource.storageObject) {
      return res.status(503).json({ error: "Secure downloads are not configured for this resource yet." });
    }
    try {
      await assertPrivateDownloadAvailable(resource.storageObject);
    } catch (storageError: any) {
      console.error("Private resource availability check failed:", storageError?.name || "StorageError");
      return res.status(503).json({
        error: "Secure resource storage is not configured or the PDF is not uploaded yet. No payment has been taken.",
      });
    }
    if (!Number.isFinite(resource.price) || resource.price < 1) {
      return res.status(400).json({ error: "This resource is not configured for online payment." });
    }

    const razorpay = getRazorpay();
    if (!razorpay) {
      return res.status(503).json({ error: "Online payment is temporarily unavailable." });
    }

    try {
      const order = await razorpay.orders.create({
        amount: Math.round(resource.price * 100),
        currency: "INR",
        receipt: `res_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
        notes: { resource_id: resource.id, customer_email: verifiedOrderUser?.email || customerEmail, customer_uid: verifiedOrderUser?.uid || "guest" },
      });
      res.json(order);
    } catch (error: any) {
      // Keep provider diagnostics in server logs; do not expose internal error details to clients.
      console.error("Razorpay order creation failed:", error?.name || "ProviderError");
      res.status(502).json({
        error: "Unable to create a payment order right now. Please try again later."
      });
    }
  });

  // Razorpay webhook recovery for captured payments if the browser callback is interrupted.
  app.post("/api/razorpay-webhook", async (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(503).json({ received: false, error: "Payment webhook is not configured." });
    }

    const signatureHeader = req.headers["x-razorpay-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody || typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) {
      return res.status(400).json({ received: false, error: "Invalid webhook signature." });
    }

    const expectedSignature = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest();
    const providedSignature = Buffer.from(signature, "hex");
    if (!(providedSignature.length === expectedSignature.length && crypto.timingSafeEqual(expectedSignature, providedSignature))) {
      return res.status(400).json({ received: false, error: "Invalid webhook signature." });
    }

    if (req.body?.event !== "payment.captured") {
      return res.status(200).json({ received: true, ignored: true });
    }

    const paymentEntity = req.body?.payload?.payment?.entity;
    const orderId = typeof paymentEntity?.order_id === "string" ? paymentEntity.order_id : "";
    const paymentId = typeof paymentEntity?.id === "string" ? paymentEntity.id : "";
    if (!orderId || !paymentId) {
      return res.status(400).json({ received: false, error: "Captured payment webhook is missing its order/payment ID." });
    }

    const razorpay = getRazorpay();
    if (!razorpay) {
      return res.status(503).json({ received: false, error: "Payment verification is temporarily unavailable." });
    }

    try {
      const [order, payment] = await Promise.all([
        razorpay.orders.fetch(orderId),
        razorpay.payments.fetch(paymentId),
      ]);
      const resourceId = typeof order.notes?.resource_id === "string" ? order.notes.resource_id : "";
      const resource = resources.find((item) => item.id === resourceId);
      const expectedAmount = resource && Number.isFinite(resource.price) ? Math.round(resource.price * 100) : -1;
      const paymentAmount = Number(payment.amount);
      const orderAmount = Number(order.amount);

      if (
        !resource ||
        order.id !== orderId ||
        payment.order_id !== orderId ||
        payment.id !== paymentId ||
        payment.status !== "captured" ||
        !Number.isSafeInteger(paymentAmount) ||
        paymentAmount !== orderAmount ||
        orderAmount !== expectedAmount ||
        payment.currency !== "INR" ||
        order.currency !== "INR"
      ) {
        return res.status(400).json({ received: false, error: "Payment does not match a captured catalogue order." });
      }

      const userEmail = typeof order.notes?.customer_email === "string" ? order.notes.customer_email : "";
      if (!userEmail) {
        console.error("Captured payment webhook is missing a customer contact field.");
        return res.status(503).json({ received: false, error: "Captured order is missing its contact email." });
      }

      const ownerId = typeof order.notes?.customer_uid === "string" ? order.notes.customer_uid : "guest";
      await persistPaidOrder({
        orderId: order.id,
        paymentId: payment.id,
        userId: ownerId,
        userEmail,
        resourceId: resource.id,
        resourceTitle: resource.title,
        amount: paymentAmount,
        currency: payment.currency,
      });
      const emailDelivery = await emailPaidResourceIfConfigured(order, payment, resource, ownerId, userEmail);
      if (emailDelivery === 'failed') {
        // Ask Razorpay to retry; Resend's idempotency key prevents duplicate delivery.
        return res.status(503).json({ received: false, recorded: true, error: "Paid order was recorded; resource email delivery will be retried." });
      }
      return res.status(200).json({ received: true, recorded: true, emailDelivery });
    } catch (error: any) {
      console.error("Razorpay webhook processing failed:", error?.name || "WebhookError");
      return res.status(503).json({ received: false, error: "Webhook processing failed; Razorpay may retry." });
    }
  });

  const verifyRazorpayPaymentLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Too many payment verification attempts. Please try again later." },
  });

  // Razorpay Payment Verification
  app.post("/api/verify-razorpay-payment", verifyRazorpayPaymentLimiter, async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      return res.status(503).json({ success: false, error: "Payment verification is temporarily unavailable." });
    }
    if (
      typeof razorpay_order_id !== "string" || !razorpay_order_id ||
      typeof razorpay_payment_id !== "string" || !razorpay_payment_id ||
      typeof razorpay_signature !== "string" || !/^[a-f0-9]{64}$/i.test(razorpay_signature)
    ) {
      return res.status(400).json({ success: false, message: "Invalid payment verification payload." });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest();
    const providedSignature = Buffer.from(razorpay_signature, "hex");

    if (!(providedSignature.length === expectedSignature.length && crypto.timingSafeEqual(expectedSignature, providedSignature))) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    // A valid signature alone does not prove that the payment was captured for the
    // expected catalogue price. Cross-check both records with Razorpay's API.
    const razorpay = getRazorpay();
    if (!razorpay) {
      return res.status(503).json({ success: false, error: "Payment verification is temporarily unavailable." });
    }

    try {
      const [order, payment] = await Promise.all([
        razorpay.orders.fetch(razorpay_order_id),
        razorpay.payments.fetch(razorpay_payment_id),
      ]);
      const resourceId = typeof order.notes?.resource_id === "string" ? order.notes.resource_id : "";
      const resource = resources.find((item) => item.id === resourceId);
      const expectedAmount = resource && Number.isFinite(resource.price) ? Math.round(resource.price * 100) : -1;
      const paymentAmount = Number(payment.amount);
      const orderAmount = Number(order.amount);

      if (
        !resource ||
        order.id !== razorpay_order_id ||
        payment.order_id !== razorpay_order_id ||
        payment.id !== razorpay_payment_id ||
        payment.status !== "captured" ||
        !Number.isSafeInteger(paymentAmount) ||
        paymentAmount !== orderAmount ||
        orderAmount !== expectedAmount ||
        payment.currency !== "INR" ||
        order.currency !== "INR"
      ) {
        return res.status(400).json({ success: false, message: "Payment does not match a captured catalogue order." });
      }

      // Record the captured payment in Firestore from the trusted server before releasing access.
      // The browser is never allowed to mark an order as paid.
      const orderedUserId = typeof order.notes?.customer_uid === "string" ? order.notes.customer_uid : "guest";
      const authorization = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
      let verifiedUser: { uid: string; email: string | null; emailVerified: boolean } | null = null;
      if (authorization.startsWith("Bearer ")) {
        try {
          verifiedUser = await verifyFirebaseIdToken(authorization.slice(7).trim());
        } catch {
          return res.status(401).json({
            success: false,
            paymentVerified: true,
            retryable: true,
            error: "Razorpay verified the payment, but your account could not be re-verified. Sign in and retry verification; do not pay again.",
          });
        }
      }

      if (orderedUserId !== "guest" && (!verifiedUser || !verifiedUser.emailVerified || verifiedUser.uid !== orderedUserId)) {
        return res.status(401).json({
          success: false,
          paymentVerified: true,
          retryable: true,
          error: "This payment belongs to a different Curiva account. Sign in to the account used at checkout and retry; do not pay again.",
        });
      }
      const orderOwnerId = orderedUserId === "guest" ? "guest" : verifiedUser!.uid;
      const userEmail = (orderOwnerId !== "guest" ? verifiedUser?.email : null) ||
        (typeof order.notes?.customer_email === "string" ? order.notes.customer_email : "");
      if (!userEmail) {
        return res.status(503).json({
          success: false,
          paymentVerified: true,
          retryable: false,
          error: "Razorpay verified the payment, but the order has no verified contact email. Do not pay again; contact Curiva support with your payment ID.",
        });
      }

      let downloadUrl: string;
      try {
        // The object was checked before checkout, but signed URLs are created only after capture.
        downloadUrl = createSignedDownloadUrl(resource.storageObject, 3600);
      } catch (downloadError: any) {
        console.error("Private download signing failed:", downloadError?.name || "SigningError");
        return res.status(503).json({
          success: false,
          paymentVerified: true,
          retryable: true,
          error: "Razorpay verified your payment, but the secure download link could not be issued. Retry verification; do not pay again.",
        });
      }

      try {
        await persistPaidOrder({
          orderId: order.id,
          paymentId: payment.id,
          userId: orderOwnerId,
          userEmail,
          resourceId: resource.id,
          resourceTitle: resource.title,
          amount: paymentAmount,
          currency: payment.currency,
        });
      } catch (recordError: any) {
        const configured = isPaidOrderStoreConfigured();
        console.error("Captured payment could not be persisted:", recordError?.name || "StorageError");
        return res.status(503).json({
          success: false,
          paymentVerified: true,
          retryable: configured,
          error: configured
            ? "Razorpay verified your payment, but secure order recording is temporarily unavailable. Retry verification here; do not pay again."
            : "Razorpay verified your payment, but secure order recording is not configured. Do not pay again; contact Curiva support with your payment ID.",
        });
      }

      const emailDelivery = await emailPaidResourceIfConfigured(order, payment, resource, orderOwnerId, userEmail);
      return res.json({
        success: true,
        message: "Payment verified and securely recorded.",
        resourceId: resource.id,
        downloadUrl,
        emailDelivery,
        orderId: order.id,
        amount: paymentAmount,
        currency: payment.currency,
      });
    } catch (error: any) {
      console.error("Razorpay verification lookup failed:", error?.name || "ProviderError");
      return res.status(502).json({ success: false, error: "Could not confirm payment status with Razorpay. Please contact support before retrying." });
    }
  });

  // Personalization is deterministic and local-data-minimal. Do not inspect
  // open-tab URLs, page titles, profile objects or free-text prompts, and do
  // not forward user context to any third party.
  const personalizationRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
  app.post("/api/personalize", personalizationRateLimiter, (req, res) => {
    const requestedRole = req.body && typeof req.body.role === "string"
      ? req.body.role.trim().toLowerCase().slice(0, 40)
      : "student";
    const role = (["student", "intern", "practitioner", "public"].includes(requestedRole)
      ? requestedRole
      : "student") as "student" | "intern" | "practitioner" | "public";

    const config = {
      student: {
        tone: "academic",
        nav: [
          { name: "BHMS Course Syllabus", to: "/cbdc-syllabus", icon: "GraduationCap", desc: "NCH competencies and curriculum" },
          { name: "Anatomy Core", to: "/anatomy", icon: "Activity", desc: "Anatomy library and notes" },
          { name: "Physiology Core", to: "/physiology", icon: "Activity", desc: "Physiology and biochemistry" },
          { name: "MCQ Practice", to: "/mcq-practice", icon: "Sparkles", desc: "Academic revision questions" }
        ],
        modules: [
          { id: "syllabus", title: "BHMS Course Syllabus", cta: "Explore curriculum", link: "/cbdc-syllabus", desc: "Review year-wise competencies and learning outcomes." }
        ],
        searchDefaults: ["Anatomy study guides", "Organon aphorisms", "Physiology revision"],
        recommendations: [{ title: "MCQ Practice Board", link: "/mcq-practice", snippet: "Practise academic questions and review explanations." }]
      },
      intern: {
        tone: "academic",
        nav: [
          { name: "Materia Medica", to: "/materia-medica", icon: "BookOpen", desc: "Reference profiles for study" },
          { name: "Clinical Guides", to: "/clinical-guides", icon: "BookMarked", desc: "General educational reading" },
          { name: "MCQ Practice", to: "/mcq-practice", icon: "Sparkles", desc: "Academic revision questions" }
        ],
        modules: [
          { id: "clinical-guides", title: "Clinical Education Library", cta: "Open guides", link: "/clinical-guides", desc: "General educational information; not a patient assessment or clinical decision tool." }
        ],
        searchDefaults: ["Materia Medica terminology", "Clinical examination principles", "Medical terminology"],
        recommendations: [{ title: "Materia Medica", link: "/materia-medica", snippet: "Review historical and academic reference descriptions." }]
      },
      practitioner: {
        tone: "academic",
        nav: [
          { name: "Materia Medica", to: "/materia-medica", icon: "BookOpen", desc: "Academic reference library" },
          { name: "Remedy Comparison", to: "/analysis", icon: "GitCompare", desc: "Educational comparison" },
          { name: "Public Health Education", to: "/public-education", icon: "Globe", desc: "Evidence and safety literacy" }
        ],
        modules: [
          { id: "comparative", title: "Comparative Study", cta: "Open comparison", link: "/analysis", desc: "Compare historical materia medica descriptions for academic study only." }
        ],
        searchDefaults: ["Materia Medica comparisons", "Historical repertory terminology", "Evidence appraisal"],
        recommendations: [{ title: "Public Health Education", link: "/public-education", snippet: "Review plain-language health education and evidence notes." }]
      },
      public: {
        tone: "simple",
        nav: [
          { name: "Public Health Education", to: "/public-education", icon: "Globe", desc: "Plain-language health education" },
          { name: "Health eBooks", to: "/ebooks", icon: "BookMarked", desc: "Read public health guides" },
          { name: "About Curiva", to: "/about", icon: "Info", desc: "About this educational project" }
        ],
        modules: [
          { id: "ebooks", title: "Public Health eBooks", cta: "Read eBooks", link: "/ebooks", desc: "Read general health information and know when to seek professional care." }
        ],
        searchDefaults: ["Understanding common health conditions", "When to seek medical help", "Evaluating health information"],
        recommendations: [{ title: "Public Health Education", link: "/public-education", snippet: "Explore evidence-aware health education in accessible language." }]
      }
    }[role];

    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    return res.json({
      role,
      tone: config.tone,
      nav: config.nav,
      modules: config.modules,
      searchDefaults: config.searchDefaults,
      recommendations: config.recommendations,
      sourceTabs: []
    });
  });

  // API Routes
  app.get("/api/posts", (req, res) => {
    const { category, search, tag, startDate, endDate } = req.query;
    let filtered = [...postsDb];

    if (category && category !== "All") {
      filtered = filtered.filter(p => p.category === category);
    }
    
    if (search) {
      const searchStr = (search as string).toLowerCase();
      filtered = filtered.filter(p => 
        (p.title && p.title.toLowerCase().includes(searchStr)) ||
        (p.excerpt && p.excerpt.toLowerCase().includes(searchStr)) ||
        (p.content && p.content.toLowerCase().includes(searchStr))
      );
    }

    if (tag) {
      const tagStr = (tag as string).toLowerCase();
      filtered = filtered.filter(p => 
        p.tags && p.tags.some((t: string) => t.toLowerCase() === tagStr)
      );
    }

    if (startDate) {
      filtered = filtered.filter(p => new Date(p.date) >= new Date(startDate as string));
    }

    if (endDate) {
      filtered = filtered.filter(p => new Date(p.date) <= new Date(endDate as string));
    }

    res.json(filtered);
  });

  app.get("/api/posts/slug/:slug", (req, res) => {
    try {
      const slugParam = req.params.slug;
      console.log(`[API] Fetching post by slug: ${slugParam}`);
      let post = postsDb.find(p => p.slug === slugParam);
      
      // Fallback to checking by ID if slug doesn't match
      if (!post) {
        post = postsDb.find(p => p.id === slugParam);
      }

      if (post) {
        res.json(post);
      } else {
        console.warn(`[API] Post not found for slug or id: ${slugParam}`);
        res.status(404).json({ error: "Post not found" });
      }
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "StorageError";
      console.error("[API] Public article lookup failed:", errorName);
      res.status(500).json({ error: "Failed to fetch post" });
    }
  });

  app.get("/api/posts/:id", (req, res) => {
    try {
      const post = postsDb.find(p => p.id === req.params.id);
      if (post) {
        res.json(post);
      } else {
        res.status(404).json({ error: "Post not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch post" });
    }
  });

  // Vite middleware for development
  if (!isServerlessRuntime && process.env.NODE_ENV !== "production") {
    // Load Vite only in the local development server. Keeping it out of the
    // static import graph prevents Netlify's function bundler from tracing
    // Vite's native CSS transformer dependencies into the serverless API.
    const vitePackage = "vite";
    const { createServer: createViteServer } = await import(vitePackage);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!isServerlessRuntime) {
    // The Netlify function serves API routes only. Netlify's static hosting
    // handles SPA assets and rewrites, so do not register a browser fallback
    // in the serverless Express app.
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!isServerlessRuntime) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

// Reuse the exact same API routes in the standalone server and Netlify Function adapter.
export const appPromise = startServer();
