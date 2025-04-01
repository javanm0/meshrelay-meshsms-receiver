Node.js API that interfaces with Twilio SMS API to receive all incoming messages and save them to the MongoDB. 

Use the following commands to deploy with Docker:

```
sudo docker pull meshrelay0/meshrelay-meshsms-receiver:latest
sudo docker run -d -p 3050:3050 \
  --name meshsms-receiver \
  --network network_name \
  -e MONGODB_URI=mongodb_uri \
  -e TWILIO_ACCOUNT_SID=twilio_sid \
  -e TWILIO_AUTH_TOKEN=twilio_auth \
  -e PROCESS_INTERVAL=1000 \
  -e SENDER_PHONE_NUMBER=twilio_number \
  meshrelay0/meshrelay-meshsms-receiver:latest
```
