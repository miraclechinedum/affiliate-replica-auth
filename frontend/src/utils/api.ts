import axios from 'axios'

interface ImportMetaEnv {
  VITE_API_BASE?: string;
}

interface ImportMeta {
  env: ImportMetaEnv;
}

// @ts-ignore
const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:5000', withCredentials: true })
export default api
