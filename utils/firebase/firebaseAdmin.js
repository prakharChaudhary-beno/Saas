// utils/firebase/firebaseAdmin.js
// Firebase Admin SDK for push notifications
"use strict";

const admin = require("firebase-admin");

// ─── Initialize Firebase Admin ───────────────────────────────────────────────
let firebaseInitialized = false;

const initializeFirebase = () => {
  try {
    if (firebaseInitialized) {
      return admin;
    }

    // Check if service account is configured
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
      console.warn("[Firebase] Missing credentials - push notifications disabled");
      console.warn("[Firebase] Required env vars: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL");
      return null;
    }

    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || undefined,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID || undefined,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });

    firebaseInitialized = true;
    console.log("[Firebase] Admin SDK initialized successfully");
    return admin;

  } catch (error) {
    console.error("[Firebase] Initialization failed:", error.message);
    return null;
  }
};

// ─── Send Push Notification ──────────────────────────────────────────────────
const sendPushNotification = async ({
  fcmTokens,          // Array of FCM tokens
  title,
  body,
  data = {},         // Custom data payload
  imageUrl = null,
  priority = "high",
  ttl = 86400,       // 24 hours
  notificationId = null
}) => {
  try {
    if (!fcmTokens || fcmTokens.length === 0) {
      console.warn("[Push] No FCM tokens provided");
      return { success: false, message: "No tokens" };
    }

    const firebase = initializeFirebase();
    if (!firebase) {
      return { success: false, message: "Firebase not initialized" };
    }

    // Filter valid tokens (must be strings, non-empty)
    const validTokens = fcmTokens.filter(t => typeof t === 'string' && t.trim().length > 0);

    if (validTokens.length === 0) {
      console.warn("[Push] No valid FCM tokens after filtering");
      return { success: false, message: "No valid tokens" };
    }

    // Prepare message payload
    const message = {
      notification: {
        title: title,
        body: body,
        ...(imageUrl && { image: imageUrl })
      },
      data: {
        // Stringify all data values (FCM requirement)
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])
        ),
        notificationId: notificationId || `notif_${Date.now()}`,
        timestamp: String(Date.now())
      },
      tokens: validTokens,
      android: {
        notification: {
          priority: priority,
          channelId: "hrms_notifications",
          sound: "default",
          clickAction: "FLUTTER_NOTIFICATION_CLICK"
        },
        priority: priority === "high" ? "high" : "normal",
        ttl: ttl * 1000  // Convert to milliseconds
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: title,
              body: body
            },
            sound: "default",
            badge: 1,
            mutableContent: 1
          }
        },
        headers: {
          "apns-priority": priority === "high" ? "10" : "5",
          "apns-expiration": String(Math.floor(Date.now() / 1000) + ttl)
        }
      },
      webpush: {
        notification: {
          title: title,
          body: body,
          icon: "/logo.png",
          badge: "/badge.png",
          ...(imageUrl && { image: imageUrl }),
          actions: data.actionUrl ? [
            {
              action: "open",
              title: data.actionLabel || "Open"
            }
          ] : []
        },
        fcmOptions: {
          link: data.actionUrl || "/"
        }
      }
    };

    // Send multicast message
    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(`[Push] Sent: ${response.successCount}/${validTokens.length} successful`);

    // Track failed tokens for cleanup
    const failedTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        console.error(`[Push] Token ${validTokens[idx]} failed:`, resp.error?.message);
        // Mark for removal if token is invalid
        if (resp.error?.code === 'messaging/invalid-registration-token' ||
            resp.error?.code === 'messaging/registration-token-not-registered') {
          failedTokens.push(validTokens[idx]);
        }
      }
    });

    return {
      success: response.successCount > 0,
      successCount: response.successCount,
      failureCount: response.failureCount,
      failedTokens: failedTokens
    };

  } catch (error) {
    console.error("[Push] Send failed:", error.message);
    return { success: false, error: error.message };
  }
};

// ─── Send to Topic (for broadcast notifications) ─────────────────────────────
const sendTopicNotification = async ({
  topic,              // e.g., "org_123", "company_456"
  title,
  body,
  data = {},
  imageUrl = null,
  priority = "high"
}) => {
  try {
    const firebase = initializeFirebase();
    if (!firebase) {
      return { success: false, message: "Firebase not initialized" };
    }

    const message = {
      notification: {
        title: title,
        body: body,
        ...(imageUrl && { image: imageUrl })
      },
      data: {
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])
        ),
        timestamp: String(Date.now())
      },
      topic: topic,
      android: {
        notification: {
          priority: priority,
          channelId: "hrms_notifications",
          sound: "default"
        }
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);

    console.log(`[Push] Topic notification sent:`, response);
    return { success: true, messageId: response };

  } catch (error) {
    console.error("[Push] Topic send failed:", error.message);
    return { success: false, error: error.message };
  }
};

// ─── Subscribe/Unsubscribe to Topic ─────────────────────────────────────────
const subscribeToTopic = async (tokens, topic) => {
  try {
    const firebase = initializeFirebase();
    if (!firebase) return { success: false };

    const response = await admin.messaging().subscribeToTopic(tokens, topic);
    console.log(`[Firebase] Subscribed ${response.successCount} tokens to ${topic}`);
    return { success: true, response };
  } catch (error) {
    console.error("[Firebase] Subscribe failed:", error.message);
    return { success: false, error: error.message };
  }
};

const unsubscribeFromTopic = async (tokens, topic) => {
  try {
    const firebase = initializeFirebase();
    if (!firebase) return { success: false };

    const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);
    console.log(`[Firebase] Unsubscribed ${response.successCount} tokens from ${topic}`);
    return { success: true, response };
  } catch (error) {
    console.error("[Firebase] Unsubscribe failed:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  initializeFirebase,
  sendPushNotification,
  sendTopicNotification,
  subscribeToTopic,
  unsubscribeFromTopic
};
