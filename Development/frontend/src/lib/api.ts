import axios from "axios";

const rawBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : `${rawBase.replace(/\/+$/, "")}/api`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Basic error handling/logging
    return Promise.reject(error);
  }
);
