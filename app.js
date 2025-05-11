const url = require("url");
const fs = require("fs");
const http = require("http");
const mongoose =require("mongoose");
const {Farmer,farmerSchema,signup} =require ("./signup.js");
const { spawn } = require('child_process');
const login = require("./login.js");
const authenticate = require("./auth.js");
const nodemailer = require("nodemailer");
//CONNECTING TO MONGODB ATLAS SERVER
mongoose.connect("mongodb://localhost:27017/",{
    useNewUrlParser: true
}).then((conn)=>{
   console.log('Connection successful with ATLAS');
}).catch((err)=>{
    console.log('error handled');
})


// OBJECT SCHEMAS AND MODEL
const fieldSchema= new mongoose.Schema({
    name:String,
    farmerId: { type: mongoose.Schema.Types.ObjectId, ref: "Farmer" } ,
    fieldLocation : String,
    sensorType: String
})
const Field = mongoose.model('Field',fieldSchema);

const thresholdSchema= new mongoose.Schema({
    threshold :Number,
    fieldId : mongoose.Schema.Types.ObjectId,
    timestamp: { type: Date, default: Date.now } 
})
const Threshold = mongoose.model('Thresholds',thresholdSchema);

const currentStatusSchema = new mongoose.Schema({
    fieldId : { type : mongoose.Schema.Types.ObjectId, required :true},
    name:String,
    waterOrMoisture : Number,
    rain : Boolean,
    temp : Number,
    humidity : Number,
    motorStatus : String,
    command : String,
    timestamp: { type: Date, default: Date.now }
})
const currentStatus = mongoose.model('CurrentStatuses',currentStatusSchema);

const sensorHistorySchema = new mongoose.Schema({
  fieldId: mongoose.Schema.Types.ObjectId,
  name: String,
  sensorType: String,
  temp : Number,
  humidity : Number, // NEW
  sensorValue: Number, // NEW (generalized)
  rainDetected: Boolean,
  motorStatus: String,
  timestamp: { type: Date, default: Date.now }
});

const SensorHistory = mongoose.model('SensorHistories', sensorHistorySchema);




//READING FILES
const fieldsHtml = fs.readFileSync("./Templates/fields.html", "utf-8");
const fieldDetailsHtml=fs.readFileSync("./Templates/fieldDetails.html", "utf-8");
const fieldCardHtml=fs.readFileSync("./Templates/fieldCard.html", "utf-8");
const homeHtml = fs.readFileSync("./Templates/home.html", "utf-8");
const signupHtml = fs.readFileSync("./Templates/signup.html", "utf-8");
const loginHtml = fs.readFileSync("./Templates/login.html", "utf-8");



const port = 5000;
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
      user: "tharunraj12082005@gmail.com",
      pass: "lpod wkky elra wfai"
  },
  });

async function sendAlert(field , level){
    let message ="";
   if(level === 1){
      message  = "Slight malfunction detected"
   }
   else if(level === 2){
    message  = "Moderate malfunction detected"
   }
   else{
    message  = "Heavy malfunction detected. Immediate action needed"
   }

   try{
    await transporter.sendMail({
        from: "tharunraj12082005@gmail.com",
        to: "itharunrajofficial@gmail.com",
        subject: message,
        text: message +" in " + field + " field ",
    });
    console.log("mail sent");
    
   }
   catch(error){
    console.log("error");
    

}
}
//TEMPLATE TO HTML CONVERSION


function replaceHtml(template,field){
   
   let output=template.replace("{{%NAME%}}", field.name);
       output=output.replace("{{%LOCATION%}}", field.fieldLocation);
       output = output.replace("{{%ID%}}", field._id);
       output = output.replace("{{%SENSOR%}}", field.sensorType);
    return output;
}

async function anomalyDetect() {
  try {
       const sensorData = await SensorHistory.find(
           {},
           { sensorType: 1, sensorValue: 1, humidity: 1, temp: 1, _id: 0, name: 1 }
            ).limit(50);

            const moistureData = sensorData.filter(d => d.sensorType === "Moisture");
            const waterData = sensorData.filter(d => d.sensorType === "Ultrasonic");
            const py = spawn("python", ["anomaly_detect.py"]);

              const payload = {
                 moisture: moistureData,
                ultrasonic: waterData
              };

             py.stdin.write(JSON.stringify(payload));
             py.stdin.end();
             
             let output = "";
             py.stdout.on("data", (data) => {
               output += data.toString();
             });
         
             py.stderr.on("data", (err) => {
               console.error("Python stderr:", err.toString());
             });
         
             py.on("close", (code) => {
              if (code !== 0) {
                console.error(`Python script exited with code ${code}`);
                return;
              }
        
              try {
                const result = JSON.parse(output);
              //  console.log("Anomaly Detection Result:", result);
              const moistureAnomalies = result.moisture.filter(Boolean).length;
              const ultrasonicAnomalies = result.ultrasonic.filter(Boolean).length;
              console.log(moistureAnomalies,ultrasonicAnomalies)
            
              
              if (moistureAnomalies >= 3) {
                sendAlert("Paddy",1);
              }
              else if(ultrasonicAnomalies >=3){
                sendAlert("Paddy",1);
              }
              else if (moistureAnomalies >= 5) {
                sendAlert("Paddy",2);
              }
              else if(ultrasonicAnomalies >=5){
                sendAlert("Paddy",2);
              }
              else if (moistureAnomalies >= 10) {
                sendAlert("Paddy",3);
              }
              else if(ultrasonicAnomalies >=10){
                sendAlert("Paddy",3);
              }


              } catch (e) {
                console.error("Error parsing Python output:", e);
              }
            });
    
      }

   catch (err) {
      console.error("Error saving sensor history:", err);
  }
}

setInterval(anomalyDetect, 1*60*1000);

async function saveSensorHistory() {
  try {
      const currentData = await currentStatus.find(); // Get all current fields
      
      const historyDocs = currentData.map(data => {
          let sensorType = "Unknown";

          // Decide sensorType based on field name (or later make it field property)
          if (data.name.toLowerCase().includes("brinjal")) {
              sensorType = "Moisture";
          } else if (data.name.toLowerCase().includes("paddy")) {
              sensorType = "Ultrasonic";
          }

          return {
              fieldId: data.fieldId,
              name: data.name,
              sensorType,
              sensorValue: data.waterOrMoisture,
              temp : data.temp,
              humidity : data.humidity, // general value
              rainDetected: data.rain,
              motorStatus: data.motorStatus,
              timestamp: new Date()
          };
      });

      await SensorHistory.insertMany(historyDocs);

      console.log("✅ Sensor history saved!");
  } catch (err) {
      console.error("Error saving sensor history:", err);
  }
}


setInterval(saveSensorHistory, 5*60*1000);

//ROUTING

const server = http.createServer(async(request, response) => {
    let { query, pathname: path } = url.parse(request.url, true);

    console.log(path);

   if(path=== "/home" || path=== "/"){
      response.writeHead(200,{"Content-Type": "text/html"});
      response.end(homeHtml);
   }


   else if (request.method === "GET" && path === "/signup") {
    response.end(signupHtml);
   }

   else if (request.method === "POST" && path === "/signup") {
     return signup(request, response);
   }

   else if (request.method === "GET" && path === "/login") {
    response.end(loginHtml);
   }

   else if (request.method === "POST" && path === "/login") {
     return login(request, response);
   }

   else if(path.startsWith("/fieldsauth") && request.method === "GET"){
      authenticate(request,response,async ()=>{
        try{
            let fields= await Field.find({farmerId: request.farmerId});
            console.log(fields);
            let fieldHtmlArray= fields.map((field)=>replaceHtml(fieldCardHtml,field));
            response.writeHead(200,{"Content-Type": "text/html"});
            console.log(fieldHtmlArray);
            response.end(JSON.stringify({fieldHtml : fieldHtmlArray.join("")}));
         }
      catch(error){
        response.writeHead(500,{"Content-Type": "text/html"});
        //console.log(error);
      }

      })
      
        
    }
    
    else if(path=== "/fields" && request.method === "GET"){
        response.writeHead(200,{"Content-Type": "text/html"});
        response.end(fieldsHtml);
    }

    else if(path.startsWith("/fields") && request.method === "POST"){
        let body = "";
        request.on("data", chunk => body += chunk.toString());
        request.on("end", async () => {
            const data = JSON.parse(body);
            try {
                const newField = await Field.create({
                    name: data.name,
                    farmerId: data.farmerId ,
                    fieldLocation : data.fieldLocation,
                    sensorType: data.sensorType,
                    
                });
                response.writeHead(201, { "Content-Type": "application/json" });
                response.end(JSON.stringify({ message: "Field Added!", field:newField }));
            } catch (error) {
                response.writeHead(500, { "Content-Type": "application/json" });
                console.log(error);
                response.end(JSON.stringify({ error: "Failed to add field" }));
            }
        });
    }
    
    else if(path.startsWith("/view") && request.method === "GET"){

        
        //if(query.id){console.log(query.id)}
        let field = await Field.findById(query.id);
        
        console.log(field);
        const city= field.fieldLocation;
        const apikey="36a5da456591edcbd3a7aa88df6a060a"
        const apiURI=`http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apikey}`;
      
        const res= await fetch(apiURI);
        const weatherdata= await res.json();
        console.log(weatherdata);
        
        response.writeHead(201, { "Content-Type": "text/html" });
        let output1=replaceHtml(fieldDetailsHtml,field);
        let weatherEmoji;
        output1=output1.replace("{{%CITY%}}",weatherdata.name).replace("{{%TEMP%}}",weatherdata["main"].temp).replace("{{%HUMIDITY%}}",weatherdata["main"].humidity).replace("{{%MAIN%}}",weatherdata["weather"][0].main);
        response.end(output1);
       
        //console.log(replaceHtml(fieldDetailsHtml,field))
    }
    
    else if( path.startsWith("/currentStatus") && request.method === "GET"){
        const fieldIdString = path.split('/').pop();
        const fieldId = new mongoose.Types.ObjectId(fieldIdString);
        const field = await currentStatus.findOne({fieldId});
        const threshold = await Threshold.findOne({fieldId});
        response.writeHead(201,{ "Content-Type": "application/json" })
        response.end(JSON.stringify({field , threshold }));

    }

    else if( path.startsWith("/manualcommands") && request.method === "GET"){
      const fieldIdString = path.split('/').pop();
      const fieldId = new mongoose.Types.ObjectId(fieldIdString);
      const field = await currentStatus.findOne({fieldId});
      response.writeHead(201,{ "Content-Type": "application/json" })
      response.end(JSON.stringify({
        command : field.command
      }));

  }

  else if( path.startsWith("/manualcommands") && request.method === "POST"){
    let body ="";
    request.on("data",(chunk)=> body+=chunk.toString());
    request.on("end",async()=>{
        try{
         const data = JSON.parse(body);
         const { command ,fieldId} = data;

         const exists = await currentStatus.findOne({fieldId});
         
        
         const updated = await currentStatus.findOneAndUpdate(
           { fieldId },
           {
             $set: {
               command
             }
           },
            { upsert: true, new: true }
         );

         response.writeHead(200, { "Content-Type": "application/json" });
         console.log(`updated ${command}`);
         response.end(JSON.stringify({ message: "Status updated", updated }));
      } catch (err) {
         console.log("Error updating status:", err);
         response.writeHead(500, { "Content-Type": "application/json" });
         response.end(JSON.stringify({ error: "Server error" }));
       }
    });
   

}

 /*else if(path.startsWith("/anamoly") && request.method === "GET"){
   
 }*/
    else if( path.startsWith("/currentStatus") && request.method === "PATCH"){
        let body ="";
        request.on("data",(chunk)=> body+=chunk.toString());
        request.on("end",async()=>{
            try{
             const data = JSON.parse(body);
             const { fieldId, waterOrMoisture, rain, motorStatus, temp ,humidity } = data;

             const updated = await currentStatus.findOneAndUpdate(
               { fieldId },
               {
                 $set: {
                   waterOrMoisture,
                   rain,
                   motorStatus,
                   temp,
                   humidity,
                   timestamp: new Date()
                 }
               },
               { upsert: true, new: true }
             );
     
             response.writeHead(200, { "Content-Type": "application/json" });
             response.end(JSON.stringify({ message: "Status updated", updated }));
           } catch (err) {
             console.error("Error updating status:", err);
             response.writeHead(500, { "Content-Type": "application/json" });
             response.end(JSON.stringify({ error: "Server error" }));
           }
        });
       

    }

    else if( path.startsWith("/thresholds") && request.method === "POST"){
        let body ="";
        request.on("data",(chunk)=> body+=chunk.toString());
        request.on("end",async()=>{
            try{
             const data = JSON.parse(body);
             const { fieldId, threshold } = data;

             const updated = await Threshold.findOneAndUpdate(
               { fieldId },
               {
                 $set: {
                   threshold,
                   fieldId,
                   timestamp: new Date()
                 }
               },
               { upsert: true, new: true }
             );
     
             response.writeHead(200, { "Content-Type": "application/json" });
             response.end(JSON.stringify({ message: "Status updated", updated }));
           } catch (err) {
             console.error("Error updating status:", err);
             response.writeHead(500, { "Content-Type": "application/json" });
             response.end(JSON.stringify({ error: "Server error" }));
           }
        });
       

    }
    
    else if( path.startsWith("/thresholds") && request.method === "GET"){
        const fieldIdString = path.split('/').pop();
        const fieldId = new mongoose.Types.ObjectId(fieldIdString);
        try {
            const threshold = await Threshold.findOne({ fieldId });
      
            if (!threshold) {
              response.writeHead(404, { "Content-Type": "application/json" });
              return response.end(JSON.stringify({ error: "Threshold not found" }));
            }
      
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(JSON.stringify({
              newthreshold : threshold.threshold
            }));
      
          } catch (err) {
            console.error("Error fetching threshold:", err);
            response.writeHead(500, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ error: "Server error" }));
          }
    }
    

  
    
   
    

});
//STARTING SERVER
server.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
});



