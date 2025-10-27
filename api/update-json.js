import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { fileName, jsonData } = req.body;

    if (!fileName || !jsonData) {
      return res.status(400).json({ message: "Missing fileName or jsonData" });
    }

    // File path inside the repo folder
    const filePath = `json/${fileName}`;

    // Prepare final JSON format
    const finalData = { Sheet1: jsonData };
    const fileContent = JSON.stringify(finalData, null, 2);

    // GitHub API URL
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const githubApiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

    // Get the file's current SHA
    const getResponse = await fetch(`${githubApiUrl}?ref=${branch}`, {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
      },
    });

    if (!getResponse.ok) {
      throw new Error(`Failed to fetch file info: ${getResponse.statusText}`);
    }

    const fileData = await getResponse.json();
    const sha = fileData.sha;

    // Update file on GitHub
    const updateResponse = await fetch(githubApiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Updated ${fileName} via web app`,
        content: Buffer.from(fileContent).toString("base64"),
        sha,
        branch,
      }),
    });

    if (!updateResponse.ok) {
      throw new Error(`Failed to update file: ${updateResponse.statusText}`);
    }

    const result = await updateResponse.json();

    return res.status(200).json({
      message: "JSON updated successfully and pushed to GitHub!",
      commitUrl: result.commit.html_url,
    });
  } catch (err) {
    console.error("Error updating JSON:", err);
    return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
}
