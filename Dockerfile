# Gunakan Node.js versi 18
FROM node:18

# Buat direktori kerja di dalam container
WORKDIR /app

# Copy semua file ke dalam container
COPY . .

# Install dependencies
RUN npm install

# Port yang digunakan oleh server
EXPOSE 5000

# Jalankan server
CMD ["node", "server.js"]
