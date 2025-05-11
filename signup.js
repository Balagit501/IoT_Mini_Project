const mongoose= require("mongoose");
const bcrypt = require("bcryptjs");
const farmerSchema= new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true},
    password: { type: String, required: true },
    phnumber: { type: Number, required: true },
  //  fields:{type :mongoose.Schema.Types.ObjectId, required : true}
    //farmerId: { type: mongoose.Schema.Types.ObjectId, ref: "Farmer" } 
})
farmerSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

const Farmer = mongoose.model('Farmer',farmerSchema);


async function signup(request, response) {
    let body = "";
    request.on("data", chunk => {
        body += chunk.toString();
    });

    request.on("end", async () => {
        const data = JSON.parse(body);
        if (!data.username || !data.password || !data.email) {
            response.writeHead(400, { "Content-Type": "application/json" });
            return response.end(JSON.stringify({ error: "All fields are required" }));
        }

        try {
            const newFarmer = await Farmer.create({
                username :data.username,
                email : data.email,
                password :data.password,
                phnumber :data.phnumber
            })

            response.writeHead(201, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ message: "User created successfully", farmer: newFarmer }));
        } catch (err) {
            response.writeHead(500, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ error: "Signup failed" }));
        }
    });
}

module.exports = {signup,Farmer,farmerSchema};
