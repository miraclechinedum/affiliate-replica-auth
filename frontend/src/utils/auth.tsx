import React, { createContext, useContext, useState } from 'react'
const C = createContext({ loggedIn:false, setLoggedIn:(b:boolean)=>{} })
export const AuthProvider = ({children}:any)=>{ const [loggedIn,setLoggedIn]=useState(false); return <C.Provider value={{loggedIn,setLoggedIn}}>{children}</C.Provider> }
export const useAuth = ()=> useContext(C)
