import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { fileName, jsonData } = req.body;

    if (!fileName || !jsonData) {
      return res.status(400).json({ message: "Missing fileName or jsonData" });
    }

    // Path to JSON file in your project
    const filePath = path.join(process.cwd(), "json", fileName);

    // Ensure file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: `File not found: ${fileName}` });
    }

    // Vercel filesystem is read-only, so write to /tmp
    const tempPath = path.join("/tmp", fileName);

    // Your JSON file format is {"Sheet1": [ ... ]}
    const finalData = { Sheet1: jsonData };

    fs.writeFileSync(tempPath, JSON.stringify(finalData, null, 2), "utf8");

    const updatedData = fs.readFileSync(tempPath, "utf8");

    return res.status(200).json({
      message: "JSON updated successfully!",
      updatedData: JSON.parse(updatedData),
    });
  } catch (err) {
    console.error("Error updating JSON:", err);
    return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
}