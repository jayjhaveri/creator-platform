# Use official Node.js LTS image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Expose the port (Cloud Run uses $PORT)
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
