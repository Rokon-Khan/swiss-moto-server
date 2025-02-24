const express = require("express");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");

// CORS configuration
const corsOptions = {
  origin: ["http://localhost:5173", "https://edu-management-system.surge.sh"],
  credentials: true, // Allows credentials like cookies to be sent
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions)); // Use CORS with the specified options
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

// Middleware to verify token
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hwao6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const database = client.db("swissMoto");
    const usersCollection = database.collection("users");
    const eventsCollection = database.collection("classes");

    // Generate jwt token
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // Add Events in Database

    app.post("/events", verifyToken, async (req, res) => {
      const events = req.body;
      const result = await eventsCollection.insertOne(events);
      res.send(result);
    });

    // get all Events from db
    app.get("/events", async (req, res) => {
      const result = await eventsCollection.find().toArray();
      res.send(result);
    });

    // save or update a user in db
    app.post("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = req.body;
      // check if user exists in db
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        return res.send(isExist);
      }
      const result = await usersCollection.insertOne({
        ...user,
        role: "eventManager",
        timestamp: Date.now(),
      });
      res.send(result);
    });

    // Get user From Database
    app.get("/users", async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // get user role
    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send({ role: result?.role });
    });

    // Event Manager  Events get from database
    app.get("/my-events", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res
            .status(400)
            .send({ error: "Email query parameter is required" });
        }
        const result = await eventsCollection
          .find({ "eventManager.email": email })
          .toArray();

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to fetch classes" });
      }
    });

    // Delete My  Class

    app.delete("/events/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await eventsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to delete class" });
      }
    });

    // Get The Event Detail with  id

    app.get("/events/:id", async (req, res) => {
      const { id } = req.params;

      // Validate ID
      if (!ObjectId.isValid(id)) {
        return res
          .status(400)
          .send({ success: false, message: "Invalid class ID" });
      }

      try {
        const eventData = await eventsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!eventData) {
          return res
            .status(404)
            .send({ success: false, message: "Class not found" });
        }

        res.send(eventData);
      } catch (error) {
        console.error("Error fetching class data:", error);
        res
          .status(500)
          .send({ success: false, message: "Failed to fetch class" });
      }
    });

    // Class Status Updated with ID
    app.put("/events/:id", async (req, res) => {
      const id = req.params.id;
      const updatedEvent = req.body;

      try {
        const result = await eventsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedEvent }
        );
        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Event updated successfully" });
        } else {
          res.status(404).send({ success: false, message: "Class not found" });
        }
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ success: false, message: "Failed to update class" });
      }
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("Swiss Moto Server is running");
});

app.listen(port, () => {
  console.log(`Swiss Moto Crud Server is Running on Port: ${port}`);
});
