from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from gtts import gTTS
import io
import os
import socketio

# --- Configuration ---
# Hardcoded Secret ID
HARDCODED_SECRET_ID = "13122025" 
# Session state flag
session_started = False 

# Create FastAPI app
app = FastAPI()

# Create Socket.IO server (Async)
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Model for validation ---
class SecretID(BaseModel):
    """Model to enforce input structure for the secret ID."""
    secret_id: str

# --- FastAPI Endpoints ---

@app.get("/")
async def root():
    # Show the current session status
    status = "Active" if session_started else "Pending Authorization"
    return {"message": "Bingo Backend Running", "session_status": status}

@app.post("/start_session")
async def start_session(id_data: SecretID):
    """Endpoint to validate the secret ID and start the session."""
    global session_started
    
    if id_data.secret_id == HARDCODED_SECRET_ID:
        session_started = True
        print("--- Bingo Session Authorized and Started! ---")
        # Optional: Emit a session-started event via Socket.IO
        await sio.emit('session_status', {'status': 'started', 'message': 'Session is now active!'})
        return {"message": "Session started successfully!"}
    else:
        # Prevent starting the session if the ID is incorrect
        raise HTTPException(status_code=403, detail="Invalid Secret ID. Authorization Required.")

@app.get("/tts")
async def tts(text: str, lang: str = "en"):
    """Text-to-Speech service for announcing numbers."""
    try:
        # Generate TTS using gTTS (Google Text-to-Speech)
        # Note: This endpoint does not require session_started to be True, 
        # as the master might want to test TTS before starting the game.
        tts = gTTS(text=text, lang='en', tld='us')
        
        # Save to memory buffer
        mp3_fp = io.BytesIO()
        tts.write_to_fp(mp3_fp)
        mp3_fp.seek(0)
        
        return StreamingResponse(mp3_fp, media_type="audio/mpeg")
    except Exception as e:
        print(f"TTS Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Socket.IO Events ---

@sio.event
async def connect(sid, environ):
    """Handle client connections."""
    print(f"Client connected: {sid}")
    # Inform the new client about the current session status
    await sio.emit('session_status', {'status': 'started' if session_started else 'pending', 'message': 'Session status update.'}, room=sid)

@sio.event
async def disconnect(sid):
    """Handle client disconnections."""
    print(f"Client disconnected: {sid}")

@sio.event
async def player_win(sid, data):
    """Handle a player claiming Bingo (Win)."""
    # Authorization Check
    if not session_started:
        print(f"Win attempt rejected: Session not started.")
        # Optionally send an error back to the player
        await sio.emit('error', {'message': 'Game has not started yet. Session ID required.'}, room=sid)
        return

    # data should be { 'name': 'PlayerName', 'type': 'row' | 'diagonal' | 'full' }
    print(f"Win detected: {data}")
    # Broadcast to all clients (specifically Master will listen)
    await sio.emit('bingo_win', data)

@sio.event
async def master_draw(sid, data):
    """Handle the master drawing a number."""
    # Authorization Check
    if not session_started:
        print(f"Number draw rejected: Session not started.")
        # Optionally send an error back to the master
        await sio.emit('error', {'message': 'Game has not started yet. Session ID required.'}, room=sid)
        return

    # data should be { 'number': 42 }
    print(f"Number drawn: {data}")
    # Broadcast to all players
    await sio.emit('number_drawn', data)


if __name__ == "__main__":
    import uvicorn
    # Use environment variables for host and port as required by Render/PaaS
    # Default to 0.0.0.0 and 8000 if variables are not set (e.g., for local testing)
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    
    uvicorn.run(socket_app, host=host, port=port)

    # Run the socket_app which wraps the FastAPI app
    # uvicorn.run(socket_app, host="0.0.0.0", port=8000)