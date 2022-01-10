// import { v4 as uuidv4 } from 'uuid';
const express = require('express')
const fs = require('fs-extra')
const fileUpload = require('express-fileupload');
var cors = require('cors')
var bodyParser = require('body-parser')
require('dotenv').config()

// stripe
const stripe = require('stripe')(`${process.env.DB_STRIPE_KEY}`);
const { v4: uuidv4 } = require('uuid');
// const uuid = require('uuid/v4');


// mongodb 
const { MongoClient, ObjectId } = require('mongodb');
const uri = `mongodb+srv://Car-Repair-BD:${process.env.DB_PASS}@cluster0.otjhf.mongodb.net/Car-Repair-BD?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const app = express()
app.use(cors())
// app.use(bodyParser.json())
app.use(fileUpload())
// app.use(express.limit(100000000))
const port = 5000 || process.env.PORT
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));



client.connect(err => {
    const serviceCollection = client.db("Car-Repair-BD").collection("services");
    const buyServicesCollection = client.db("Car-Repair-BD").collection("buyServices");
    const reviewsCollection = client.db("Car-Repair-BD").collection("reviews");
    const adminsCollection = client.db("Car-Repair-BD").collection("admin");
    // post service
    app.post("/addService", (req, res) => {
        const title = req.body.title
        const description = req.body.description
        const price = req.body.price
        const file = req.files.file
        const newImg = file.data;
        const encImg = newImg.toString("base64");
        const image = {
            contentType: file.mimetype,
            size: file.size,
            img: Buffer.from(encImg, "base64")
        }
        serviceCollection.insertOne({ title, description, image, price })
            .then(result => {
                if (result.insertedId) {
                    res.send(true)
                }
            })

    })
    // get service 
    app.get("/services", (req, res) => {
        serviceCollection.find({})
            .toArray((err, docs) => {
                res.send(docs)
            })
    })
    // delete service
    app.delete("/serviceDelete/:id", (req, res) => {
      const {id} = req.params
      serviceCollection.deleteOne({_id:ObjectId(id)})
      .then(result => res.send(result))
      
    })
    // get specific service 
    app.get("/serviceDetails/:id", (req, res) => {
        const serviceId = req.params.id
        serviceCollection.find({ _id: ObjectId(serviceId) })
            .toArray((err, docs) => {
                res.send(docs[0])
            })
    })
    // post review 
    app.post("/addReview", (req, res) => {
        const body = req.body
        reviewsCollection.insertOne(body)
            .then(result => {
                if (result.insertedId) {
                    res.send(true)
                }
            })

    })
    // get review 
    app.get("/review", (req, res) => {
        reviewsCollection.find({})
            .toArray((err, docs) => {
                res.send(docs)
            })
    })


    // post admin 
    app.post("/addAdmin", (req, res) => {
        const body = req.body
        adminsCollection.insertOne(body)
            .then(result => {
                if (result.insertedId) {
                    res.send(true)
                }
            })

    })
    app.get("/isAdmin/:email", (req, res) => {
        // const email = req.query.email
        const {email} = req.params
        adminsCollection.find({email:email})
          .toArray((err, doc) => {
            if(doc.length){
                res.send(true)
            }
          })
      })


    // add payment 
    app.post("/payment", (req, res) => {

        const {service , token} = req.body
        const idempontencyKey = uuidv4()

       return stripe.customers
            .create({
                email: token.email,
                source: token.id,
            })
            .then((customer) => {
                stripe.charges
                    .create({
                        customer: customer.id,
                        amount: service.price * 100,
                        currency: 'USD',
                        receipt_email : token.email,
                        description: service.name,
                        shipping:{
                            name : token.card.name,
                            address : {
                                country : token.card.address_country
                            }
                        }
                    }
                    // ,[idempontencyKey]
                    )
                    .then((result) =>{
                        const {billing_details , amount ,balance_transaction  ,customer ,payment_method_details ,receipt_email ,shipping ,source ,status} = result
                     if(status){
                        buyServicesCollection.insertOne({billing_details ,balance_transaction  ,customer ,payment_method_details ,receipt_email ,source ,service  , action:"pending" , email:token.email})
                        .then(result => {
                            if (result.insertedId) {
                                res.send(true)
                            }        
                        })
            
                     }
                    //  res.send("Payment Error")
                    })
                    .catch((err) => {
                        res.send(err)
                    });
            });
    })

    app.post("/getByServices", (req, res) => {
        const email = req.body.email
        adminsCollection.find({email:email})
          .toArray((err, adminInfo) => {
            if (adminInfo.length > 0) {
                buyServicesCollection.find({})
                .toArray((err, documents) => {
                  res.send(documents)                  
                })
            }
            else if(adminInfo.length === 0){
                buyServicesCollection.find({email:email})
                .toArray((err, documents) => {
                  res.send(documents)
                  
                })
            }
           
          })
      })
    


      
app.patch("/action/:id",(req, res)=>{
    const {id} = req.params
    const {newAction} = req.body
    buyServicesCollection.updateOne({_id: ObjectId(id)},{ $set: {action:newAction}})
    .then(result =>{
    res.send(result)
})
})
});



app.listen(port)