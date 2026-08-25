# BAN/PICK 3v3 システム

ローカルで Next.js (frontend) と Express+Socket.IO (backend) を起動するための最小構成を含みます。Dockerでの起動も可能です。

開発:

1. backend と frontend で依存をインストール

```bash
cd backend
npm install
cd ../frontend
npm install
```

2. 各側を起動

```bash
# backend
cd backend
npm run dev

# frontend
cd frontend
npm run dev
```

Docker:

```bash
docker-compose up --build
```

注意: これは骨子実装です。DB永続化や認証、完全なルール検証は今後追加してください。
