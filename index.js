// index.js
require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 4000;
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;
const BACKEND_URL = process.env.BACKEND_URL;

// 允许前端访问
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.send("GitHub OAuth backend is running.");
});

// 定向到GitHub
app.get("/auth/github/login", (req, res) => {
  const redirectUri = `${BACKEND_URL}/auth/github/callback`;

  const githubAuthUrl =
    "https://github.com/login/oauth/authorize" +
    `?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=read:user%20user:email`;

  res.redirect(githubAuthUrl);
});

// GitHub回调
app.get("/auth/github/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Missing code in callback.");
  }

  try {
    const redirectUri = `${BACKEND_URL}/auth/github/callback`;

    // 用code
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      console.error("No access token:", tokenResponse.data);
      return res.status(500).send("Failed to get access token.");
    }

    // 用access_token获取GitHub用户信息
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "bytebase-login-demo",
      },
    });

    const ghUser = userResponse.data;

    const user = {
      id: ghUser.id,
      login: ghUser.login,
      name: ghUser.name,
      avatar_url: ghUser.avatar_url,
      html_url: ghUser.html_url,
    };

    const encodedUser = Buffer.from(JSON.stringify(user)).toString("base64");
    const redirectTo = `${FRONTEND_URL}?user=${encodeURIComponent(
      encodedUser
    )}`;

    res.redirect(redirectTo);
  } catch (err) {
    console.error("GitHub OAuth callback error:", err.response?.data || err);
    res.status(500).send("GitHub OAuth error.");
  }
});

app.listen(PORT, () => {
  console.log(`OAuth server listening on http://localhost:${PORT}`);
});
