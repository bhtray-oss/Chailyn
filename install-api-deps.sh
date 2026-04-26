#!/bin/bash
VENV="/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app/services/api/.venv"
REQ="/Users/raysmacbook/Documents/Claude/Projects/Chailyn's FreeSewing APP Developing/03_程式碼專案/chailyn-app/services/api/requirements.txt"
echo "Installing Python API deps using Python 3.11 venv..."
"$VENV/bin/pip" install -r "$REQ" && echo "SUCCESS" || echo "FAILED"
