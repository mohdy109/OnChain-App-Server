const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { ethers } = require('ethers');
const DeliveryProofAbi = require('./DeliveryProof.json');

const app = express();
app.use(cors());
app.use(express.json());
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('Mongo error:', err));


const DeliverySchema = new mongoose.Schema({
  image: String,
  address: String,
  timestamp: Number,
  deliveryId: String,
  userId: String,
  txHash: String,
});

const Delivery = mongoose.model('Delivery', DeliverySchema,"OnChain-Delivery");


const provider = new ethers.JsonRpcProvider(process.env.INFURA);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  DeliveryProofAbi.abi,
  wallet
);



app.post('/submitDeliveryProof', async (req, res) => {
    console.log("POST /submitDeliveryProof hit");
  try {
    const { image, location, timestamp, deliveryId, userId, } = req.body;

    const tx = await contract.submitProof(
      deliveryId,
      userId,
      image,
      location,
      timestamp
    );
    await tx.wait();

    const newEntry = new Delivery({
      image,
      location,
      timestamp,
      deliveryId,
      userId,
      txHash: tx.hash,
    });
    await newEntry.save();

    res.json({ status: 'success', txHash: tx.hash });
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to submit proof');
  }
});

app.get('/getDeliveryProof', async (req, res) => {
    console.log("POST /submitDeliveryProof hit");
  try {
    const { deliveryId } = req.query;
    const onChainProof = await contract.getProof(deliveryId);

    if (!onChainProof[0]) return res.status(404).send('No delivery proof found');

    const dbProof = await Delivery.findOne({ deliveryId });

    res.json({
      deliveryId: onChainProof[0],
      agentEmail: onChainProof[1],
      photoUrl: onChainProof[2],
      location: onChainProof[3],
      timestamp: onChainProof[4].toString(),
      txHash: dbProof?.txHash || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching delivery proof');
  }
});


const PORT = process.env.PORT || 5050;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
