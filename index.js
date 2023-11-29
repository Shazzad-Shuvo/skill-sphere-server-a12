const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kqcyimm.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const database = client.db("skillDb");
        const userCollection = database.collection("users");
        const teacherCollection = database.collection("teachers");
        const classCollection = database.collection("classes");

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })

        // middlewares --------------------------------------
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' });
                }
                req.decoded = decoded;
                next();
            })
        }
        // use verifyAdmin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        // users related api

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        // api to check if a user is admin or not
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden access' });
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })
        // api to check if a user is teacher or not
        app.get('/users/teacher/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden access' });
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let teacher = false;
            if (user) {
                teacher = user?.role === 'teacher';
            }
            res.send({ teacher });
        })

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await userCollection.findOne(query);
            res.send(result);
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user?.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'User already exists' });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            };
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // teacher related api
        app.get('/teacher', verifyToken, verifyAdmin, async (req, res) => {
            const result = await teacherCollection.find().toArray();
            res.send(result);
        })

        app.get('/teacher/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await teacherCollection.findOne(query);
            res.send(result);
        })

        app.post('/teacher', verifyToken, async (req, res) => {
            const teacher = req.body;
            const query = { email: teacher?.email };
            const existingTeacher = await teacherCollection.findOne(query);
            if (existingTeacher?.status === 'pending') {
                return res.send({ message: 'Request already sent to admin' });
            }
            else if(existingTeacher?.status === 'accepted'){
                return res.send({ message: 'Accepted as a teacher' });
            }
            const result = await teacherCollection.insertOne(teacher);
            res.send(result);
        })

        app.patch('/teacher/accept/:id', async(req, res) =>{
            const teacherId = req.params.id;
            const filter = {_id: new ObjectId(teacherId)};
            const updatedDoc = {
                $set: {
                    status: 'accepted'
                }
            };
            const result = await teacherCollection.updateOne(filter, updatedDoc);

            const teacher = await teacherCollection.findOne(filter);
            const query = {email: teacher.email};

            const updated = {
                $set: {
                    role: 'teacher'
                }
            };

            const updateUserRole = await userCollection.updateOne(query, updated);

            res.send({result, updateUserRole});
        })
        app.patch('/teacher/reject/:id', async(req, res) =>{
            const teacherId = req.params.id;
            const filter = {_id: new ObjectId(teacherId)};
            const updatedDoc = {
                $set: {
                    status: 'rejected'
                }
            };
            const result = await teacherCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })












        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Skill Spear has been shot');
})

app.listen(port, () => {
    console.log(`Skill Spear running on port: ${port}`);
})

