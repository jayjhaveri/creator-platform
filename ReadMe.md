# Creator Platform Server

A backend server for managing brand-creator collaborations, campaign negotiations, and automated communications (email and AI voice calls). Built with Node.js, TypeScript, Express, Firebase, SendGrid, Google Cloud Tasks, and ElevenLabs AI.

## Features

- **Brand, Creator, Campaign, Deal, and Negotiation Management**: RESTful API endpoints for CRUD operations
- **Automated Email Outreach**: AI-generated, human-like cold emails to creators
- **Negotiation Workflow**: Track and manage negotiation status, rates, and communications
- **AI Voice Agent**: Initiate and manage voice calls using ElevenLabs AI, with call transcription and knowledge base
- **Follow-up Automation**: Scheduled follow-up emails and call tasks using Google Cloud Tasks
- **Swagger API Docs**: Interactive API documentation at `/api/docs`
- **Firebase Integration**: Firestore for data storage, Firebase Auth for authentication

## API Documentation

Visit [http://localhost:8080/api/docs](http://localhost:8080/api/docs) (or your deployed URL) for full Swagger docs.

## Project Structure

- `src/`
  - `agents/` — AI agents for email and reply analysis
  - `controllers/` — Express route controllers
  - `routes/` — API route definitions
  - `services/` — Business logic, integrations (voice, email, tasks)
  - `middleware/` — Express middleware (logging, auth)
  - `types/` — TypeScript types and schemas
  - `utils/` — Utility functions (logging, markdown, email, etc)
  - `docs/` — Swagger setup
- `public/` — Static files

## Getting Started

### Prerequisites

- Node.js 20+
- Firebase project (Firestore, Storage)
- Google Cloud Project (Cloud Tasks, Cloud Run)
- SendGrid account
- ElevenLabs API key

### Installation

```sh
npm install
```

### Development

```sh
npm run build
npm start
# or for hot-reload:
npm run dev
```

### Environment Variables

Create a `.env` file in the root directory:

```env
GROQ_API_KEY=your_groq_api_key
SENDGRID_API_KEY=your_sendgrid_api_key
API_BASE_URL=https://your-deployed-url
GCP_PROJECT=your_gcp_project_id
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

### Deployment

- **Docker**: Build and push the image

  ```sh
  docker buildx build --platform linux/amd64 -t <your-image> --push .
  ```

- **Google Cloud Run**: Deploy

  ```sh
  gcloud run deploy creator-server \
    --image <your-image> \
    --platform managed \
    --region <your-region> \
    --allow-unauthenticated \
    --set-env-vars GROQ_API_KEY=...,SENDGRID_API_KEY=...,API_BASE_URL=...,GCP_PROJECT=...,ELEVENLABS_API_KEY=...
  ```

## Contributing

Pull requests welcome! For major changes, open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)
