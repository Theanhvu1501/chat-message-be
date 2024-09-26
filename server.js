const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = 3001;
app.use(cors());
app.use(express.json());
API_KEY = process.env.API_KEY;
const dirPath = "../chat-message/audio_files";

app.post("/process-json", async (req, res) => {
  try {
    const jsonData = req.body;
    const folderPath = await createDatedFolder();
    await ensureAudioFilesDirectoryExists();

    const chunkSize = 10;
    let voices = [];

    // Chia jsonData thành các chunks 100 items
    for (let i = 0; i < jsonData.length; i += chunkSize) {
      const chunk = jsonData.slice(i, i + chunkSize);

      // Sử dụng Promise.all trong mỗi chunk để xử lý song song
      const chunkVoices = await Promise.all(
        chunk.map(async (voice, index) => {
          const voiceBase64 = await getVoiceBase64(
            voice.text,
            voice.voiceName,
            voice.lang
          );
          const fileName = `voice_${i + index}.wav`; // Đảm bảo tên file là duy nhất
          const filePath = await saveVoiceToFile(
            voiceBase64,
            fileName,
            folderPath
          );
          voice.audioFile = filePath.replace("\\chat-message", "");
          return voice;
        })
      );

      // Gộp kết quả từ chunk vào mảng chính
      voices = voices.concat(chunkVoices);
    }

    chatData = voices;
    await writeChatData(chatData, folderPath);
    res.json(chatData);
  } catch (error) {
    console.error("Đã xảy ra lỗi:", error);
    res.status(500).send("Đã xảy ra lỗi.");
  }
});

const createDatedFolder = async (baseDir) => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  // Tạo đường dẫn thư mục theo yyyy/mm/dd
  const datedPath = `../data/${yyyy}${mm}${dd}`;

  // Tạo thư mục yyyy/mm/dd nếu chưa tồn tại
  await fs.promises.mkdir(datedPath, { recursive: true });

  // Tạo thư mục con 1, 2, 3... nếu đã tồn tại
  let counter = 1;
  let finalPath = path.join(datedPath, `${counter}`);

  while (fs.existsSync(finalPath)) {
    counter++;
    finalPath = path.join(datedPath, `${counter}`);
  }

  // Tạo thư mục 1, 2, 3... trong yyyy/mm/dd
  await fs.promises.mkdir(finalPath, { recursive: true });
  await fs.promises.mkdir(`${finalPath}/audio_files`, { recursive: true });
  return finalPath; // Trả về đường dẫn cuối cùng
};

const saveVoiceToFile = async (base64Data, fileName, folderPath) => {
  const buffer = Buffer.from(base64Data, "base64");
  const filePath = path.join(dirPath, fileName);
  await fs.promises.writeFile(filePath, buffer);

  const newFilePath = path.join(folderPath, "audio_files", fileName);
  await fs.promises.writeFile(newFilePath, buffer);

  return filePath;
};

getVoiceBase64 = async (text, voiceName, languageCode) => {
  const apiKey = API_KEY;
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
  const request = {
    input: { text: text },
    voice: {
      languageCode,
      name: voiceName,
    },
    audioConfig: {
      audioEncoding: "LINEAR16",
      effectsProfileId: ["small-bluetooth-speaker-class-device"],
      pitch: 0,
      speakingRate: 1,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.audioContent;
  } catch (error) {
    console.error("Error calling Text-to-Speech API:", error);
  }
};

const writeChatData = async (data, folderPath) => {
  const filePath = "../chat-message/chat_data.json";
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");

  const newFilePath = path.join(folderPath, "chat_data.json");
  await fs.promises.writeFile(
    newFilePath,
    JSON.stringify(data, null, 2),
    "utf8"
  );
};

const ensureAudioFilesDirectoryExists = async () => {
  if (!fs.existsSync(dirPath)) {
    await fs.promises.mkdir(dirPath);
  }
};

app.listen(port, () => {
  console.log(`Server đang chạy trên http://localhost:${port}`);
});
