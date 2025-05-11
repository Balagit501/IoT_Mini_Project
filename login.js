const {Farmer,farmerSchema} =require ("./signup.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

async function login(request, response) {
    let body = "";
    request.on("data", chunk => {
        body += chunk.toString();
    });
    request.on("end", async () => {
        const { username, password } = JSON.parse(body);

        try {
           
            const farmer = await Farmer.findOne({ username });
            
            if (!farmer || !(await bcrypt.compare(password, farmer.password))) {
                response.writeHead(401, { "Content-Type": "application/json" });
                return response.end(JSON.stringify({ error: "Invalid credentials" }));
            }

            // Generate JWT Token
            const token = jwt.sign({ farmerId: farmer._id , username: farmer.username}, "DTProject", { expiresIn: "1h" });
            console.log("token generated",token);

            response.writeHead(200, { "Content-Type": "application/json" });
            
            response.end(JSON.stringify({ message: "Login successful", token ,username}));
        } catch (err) {
            response.writeHead(500, { "Content-Type": "application/json" });
            console.log(err);
            response.end(JSON.stringify({ error: "Login failed" }));
        }
    });
}

module.exports = login;
