export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Only POST requests allowed" });

  let body = "";
  try {
    // ✅ Read and parse raw body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks).toString();
  } catch (err) {
    return res.status(400).json({ message: "Error reading request body" });
  }

  const { updatedData } = JSON.parse(body || "{}");
  if (!updatedData) {
    return res.status(400).json({ message: "No updatedData found in request body" });
  }

  const repo = "antimoneylaundering/filemerher";
  const filePath = "json/originWebsite.json";
  const token = process.env.GITHUB_TOKEN;

  try {
    const getFile = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      headers: { Authorization: `token ${token}` },
    });
    const fileData = await getFile.json();

    const updatedContent = Buffer.from(JSON.stringify(updatedData, null, 2)).toString("base64");

    const updateResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Updated JSON via web interface",
        content: updatedContent,
        sha: fileData.sha,
      }),
    });

    const result = await updateResponse.json();
    return res.status(200).json({ message: "File updated successfully!", result });
  } catch (error) {
    return res.status(500).json({ message: "Error updating file", error: error.message });
  }
}