# Chatin

Chatin is a multi-line WhatsApp call center and customer communication platform for companies that manage several WhatsApp numbers across teams, branches, agents, or departments.

The project brings WhatsApp conversations into a centralized web panel where admins can connect multiple WhatsApp lines, assign those lines to users, monitor account status, and let agents handle customer chats in real time.

## Why Chatin?

Many companies use WhatsApp as their main sales, support, appointment, or operations channel. As the number of lines and agents grows, conversations often become scattered across personal phones and unmanaged devices.

Chatin turns that workflow into a structured customer communication system:

- Manage multiple WhatsApp lines from one panel
- Assign WhatsApp accounts to users or teams
- Let agents access only the lines assigned to them
- Track connection status and incoming messages in real time
- Keep chats and messages in a central database
- Move customer communication away from personal-device dependency

## Main Use Cases

- E-commerce sales and support teams
- Clinics, appointment-based businesses, and service providers
- Multi-branch companies
- Franchise and dealer networks
- Technical support and field service teams
- Small and medium businesses moving WhatsApp operations into a corporate panel
- Sales teams that need to route leads to representatives

## Project Structure

```text
.
├── BaileysJava      # Java WhatsApp Web connectivity library
├── ChatinJava       # Spring Boot backend API
└── Chatin_Nextjs    # Next.js frontend application
```

## Core Components

### BaileysJava

`BaileysJava` is a Java library written for this project. It provides the WhatsApp Web connectivity layer used by the backend.

It handles:

- WhatsApp WebSocket connection lifecycle
- QR-based pairing flow
- Pairing-code support
- Secure session setup
- Binary node encoding and decoding
- Connection, QR, login, and message callbacks
- File-based auth state support for standalone usage

In Chatin, this library allows the Java backend to connect to WhatsApp without depending on a separate Node.js WhatsApp service.

### ChatinJava

`ChatinJava` is the Spring Boot backend. It manages the business logic of the platform:

- Authentication and role-based access
- Companies, users, accounts, assignments, chats, and messages
- WhatsApp account lifecycle through BaileysJava
- MongoDB-backed WhatsApp auth state
- Socket.IO events for QR updates, account status, and new messages

### Chatin_Nextjs

`Chatin_Nextjs` is the web interface used by admins, managers, and agents.

It includes:

- Login and role-based dashboards
- WhatsApp account management
- QR connection flow
- Account assignment screens
- Chat list and message view
- Real-time socket updates

## Roles

- `superadmin`: manages the full system, companies, users, and accounts
- `admin`: manages company-level users and WhatsApp accounts
- `manager`: monitors and manages company operations
- `user`: handles assigned WhatsApp lines and customer chats

## Technology Stack

### Backend

- Java 21
- Spring Boot 3.2
- MongoDB
- Socket.IO via `netty-socketio`
- JWT authentication
- Maven

### WhatsApp Connectivity

- Custom Java library: `BaileysJava`
- Java-WebSocket
- Protobuf
- Signal/libsignal primitives
- ZXing for QR generation

### Frontend

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- NextAuth
- Socket.IO client

## Local Development

### Requirements

- Java 21
- Maven
- Node.js 20 or newer
- Yarn or npm
- MongoDB running locally or a MongoDB connection string

Default local ports:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Socket.IO: `http://localhost:9092`
- MongoDB: `mongodb://localhost:27017/chatin`

### 1. Install BaileysJava Locally

`ChatinJava` depends on `BaileysJava` as a Maven artifact, so install the library into your local Maven repository first.

```bash
cd BaileysJava
mvn clean install
```

### 2. Configure and Run the Backend

```bash
cd ../ChatinJava
mvn spring-boot:run
```

Useful backend environment variables:

```bash
PORT=3001
SOCKETIO_PORT=9092
MONGODB_URI=mongodb://localhost:27017/chatin
JWT_SECRET=change-this-secret
```

The backend also contains API documentation in:

```text
ChatinJava/api_endpoints.md
```

### 3. Configure and Run the Frontend

```bash
cd ../Chatin_Nextjs
yarn install
yarn dev
```

If you use npm:

```bash
npm install
npm run dev
```

Recommended frontend environment variables:

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=change-this-secret
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:9092
```

## High-Level Flow

1. An admin creates a WhatsApp account in the web panel.
2. The frontend requests a QR connection flow.
3. `ChatinJava` starts a WhatsApp connection for the selected account.
4. `BaileysJava` connects to WhatsApp Web and generates a QR pairing string.
5. The backend converts the QR data into an image and sends it to the frontend via Socket.IO.
6. The user scans the QR code from WhatsApp.
7. Auth credentials are stored in MongoDB for the account.
8. Incoming WhatsApp messages are converted into chat/message records.
9. Agents receive new messages in real time from the web panel.

## Current Status

The project currently provides the foundation for a multi-line WhatsApp call center:

- Multi-account WhatsApp connection flow
- QR-based account linking
- Account status tracking
- MongoDB auth persistence
- Role-based backend structure
- Chat and message persistence
- Real-time frontend communication
- Basic text-message flow

Some advanced features are still development areas:

- Full media message sending
- Advanced reaction support
- Smart routing rules
- Detailed reporting and analytics
- Production-grade reconnection and monitoring policies
- AI-assisted workflows

## Roadmap Ideas

- Smart routing by workload, topic, branch, or agent availability
- AI-powered reply suggestions
- Automatic customer intent detection
- CRM integrations
- SLA and response-time tracking
- Team performance dashboards
- Chatbot plus live-agent hybrid workflows
- Customer history summarization
- Omnichannel support for Instagram, web chat, and email

## Important Notice

This project uses a WhatsApp Web protocol approach through a custom Java library. It is not an official WhatsApp Business API integration and is not affiliated with WhatsApp or Meta.

Because WhatsApp Web behavior can change over time, this type of integration may require maintenance when upstream protocol changes occur. Use responsibly and review legal, compliance, and platform-policy requirements before production use.

## License

No license has been defined yet. Add a license before publishing or distributing the project publicly.

