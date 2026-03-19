import { sessionStorage } from "./client-storage";

const key = "session_token";

export const getToken = () => sessionStorage.getItemAsync(key);
export const deleteToken = () => sessionStorage.deleteItemAsync(key);
export const setToken = (v: string) => sessionStorage.setItemAsync(key, v);
