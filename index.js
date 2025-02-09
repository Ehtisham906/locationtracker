const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Use body-parser to parse incoming JSON requests
app.use(bodyParser.json());

// Enable CORS for cross-origin requests
app.use(cors());

// Initialize Firebase Admin SDK
const serviceAccount = require("/etc/secrets/serviceAccountKey.json"); // Path to your Firebase service account key

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://location-tracker-7e82f-default-rtdb.firebaseio.com" // Replace with your Firebase Database URL

});

app.get("/", (req, res) => {
    console.log("Working")
    res.send("Working")
})
// Reference to Firebase Realtime Database
const db = admin.database();
// console.log(db)

// Parent and Child Example Data (Stored in Firebase Realtime Database)
let parents = [
    { parentId: "parent1", name: "John" },
    { parentId: "parent2", name: "Jane" }
];

// Endpoint to handle the request from parent to get child details
app.post("/requestChildData", async (req, res) => {
    const { parentId, childId } = req.body;

    // Validate request data
    if (!parentId || !childId) {
        return res.status(400).json({ success: false, message: "Parent ID and Child ID are required." });
    }

    try {
        // Fetch child data from Firebase
        const childRef = db.ref(`devices/${childId}`);
        const childSnapshot = await childRef.once("value");

        console.log("Fetched child data:", childSnapshot.val()); // Debugging log

        if (!childSnapshot.exists()) {
            return res.status(404).json({ success: false, message: "Child not found." });
        }

        const childData = childSnapshot.val();

        // Return the retrieved data
        return res.status(200).json({
            success: true,
            message: "Child data retrieved successfully.",
            data: {
                androidID: childData.androidId || "N/A",
                androidVersion: childData.androidVersion || "N/A",
                deviceName: childData.deviceName || "N/A"
            }
        });
    } catch (error) {
        console.error("Error fetching child data:", error);
        return res.status(500).json({ success: false, message: "Server error." });
    }
});

app.post("/checkInternetStatus", async (req, res) => {
    const { childId } = req.body;

    if (!childId) {
        return res.status(400).json({ success: false, message: "Child ID is required." });
    }

    try {
        // FCM Token for the child device
        const token = await getChildDeviceFCMToken(childId); // Replace with your logic to fetch FCM token
        if (!token) {
            return res.status(404).json({ success: false, message: "FCM Token not found for the child device." });
        }

        // Message to send to the child device
        const message = {
            token,
            notification: {
                title: "Check Internet Connection",
                body: "Please verify if you're online.",
            },
            data: {
                action: "CHECK_INTERNET_STATUS",
            },
        };

        // Send the notification via FCM
        await admin.messaging().send(message);

        return res.status(200).json({
            success: true,
            message: "Request sent to the child device to check internet status.",
        });
    } catch (error) {
        console.error("Error sending FCM message:", error);
        return res.status(500).json({ success: false, message: "Failed to send request to the child device." });
    }
});

// Replace this function with your logic to fetch the FCM token for a child device
async function getChildDeviceFCMToken(childId) {
    const childRef = db.ref(`devices/${childId}/fcmToken`);
    const snapshot = await childRef.once("value");
    return snapshot.val();
}

app.post("/updateInternetStatus", async (req, res) => {
    const { childId, status } = req.body;

    if (!childId || !status) {
        return res.status(400).json({ success: false, message: "Child ID and status are required." });
    }

    try {
        const childRef = db.ref(`devices/${childId}`);
        await childRef.update({ status, lastChecked: Date.now() });

        return res.status(200).json({
            success: true,
            message: "Internet status updated successfully.",
        });
    } catch (error) {
        console.error("Error updating internet status:", error);
        return res.status(500).json({ success: false, message: "Failed to update internet status." });
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
