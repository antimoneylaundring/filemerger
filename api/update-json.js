import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { fileName, newData } = req.body;
    if (!fileName || !newData) {
      return res.status(400).json({ message: 'Missing fileName or data' });
    }

    // Path where JSON files are stored (inside your "json" folder)
    const filePath = path.join(process.cwd(), 'json', fileName);

    // Convert to JSON string
    const jsonString = JSON.stringify(newData, null, 2);

    // Write to the selected JSON file
    fs.writeFileSync(filePath, jsonString, 'utf-8');

    res.status(200).json({ message: `✅ ${fileName} updated successfully.` });
  } catch (error) {
    console.error('Error updating JSON:', error);
    res.status(500).json({ message: 'Error updating file', error: error.message });
  }
}