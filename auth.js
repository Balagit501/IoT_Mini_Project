const jwt = require("jsonwebtoken");




const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log(`Auth Header: ${authHeader}`);
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.log("in ath head error");
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Unauthorized: No token provided" }));
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, "DTProject");
        req.username = decoded.username; // Attach username from token payload
        console.log(decoded);
        req.farmerId = decoded.farmerId; // Attach userId if needed
        next();
    } catch (error) {
        console.log("in error",error);
        //res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Unauthorized: Invalid token" }));
    }
};

module.exports = authenticate;

