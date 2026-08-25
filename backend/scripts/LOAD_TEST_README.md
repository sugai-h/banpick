Run the concurrent load test for requestAction (Windows)

1) Open a regular Command Prompt (cmd.exe), not PowerShell.

2) From the repo root run:

```
cd backend\scripts
run_load_test.bat
```

This batch will install `socket.io-client`, run migrations, start the backend dev server in a new window, and execute `load_test.js`.

If you prefer manual steps:

```
cd backend
npm install socket.io-client@4.7.0
npm run migrate
npm run dev   # in another terminal
node scripts/load_test.js <ROOM_ID> <CHAR_ID> <CLIENT_COUNT>
```

Check the server terminal and this script's output for results.
