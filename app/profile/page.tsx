"use client";
import Link from "next/link";
import { fetchProfile } from "@/lib/store";
import { useAppDispatch, useAppSelector } from "@/lib/store-hooks";
import { useEffect, useState } from "react";
import { ArrowLeft, Coins, Gamepad2, LockKeyhole, Trophy, UserRound } from "lucide-react";
import { SecurityPanel } from "@/components/auth-controls";
export default function ProfilePage(){
    const dispatch=useAppDispatch();
    const {profile,profileStatus,profileError:error}=useAppSelector(state=>state.account);
    const [security,setSecurity]=useState(false);
    const loading=profileStatus==="idle"||profileStatus==="loading";
    const signedOut=profileStatus==="unauthenticated";
    const load=()=>dispatch(fetchProfile());
    useEffect(()=>{const request=dispatch(fetchProfile());return()=>{request.abort()}},[dispatch]);
    return <main className="app profile-shell">
        <header className="profile-navigation"><Link className="back-link" href="/?view=menu"><ArrowLeft size={18}/> Back to game</Link><span>JUNGLE DIGITS</span></header>
        <section className="profile-card" aria-labelledby="profile-title">
            <div className="card-sprout"><UserRound size={26}/></div><h1 id="profile-title">My profile</h1>
            {loading?<p role="status">Loading your profile...</p>:signedOut?<div className="profile-message"><p>Please log in to view your profile.</p><Link className="primary" href="/?view=auth">Go to login</Link></div>:error?<div className="profile-message"><p role="alert">{error}</p><button className="secondary" onClick={()=>void load()}>Try again</button></div>:profile&&<>
                <div className="profile-identity"><span className="profile-avatar" aria-hidden="true">{profile.name.charAt(0).toUpperCase()}</span><h2>{profile.name}</h2><p>Your jungle adventure, all in one place.</p></div>
                <dl className="profile-details"><div><dt>Username</dt><dd>{profile.username}</dd></div><div><dt>Email</dt><dd>{profile.email||"No email on this account"}</dd></div><div><dt>Sign-in method</dt><dd>{profile.provider==="password"?"Username and password":profile.provider==="google"?"Google":profile.provider==="github"?"GitHub":profile.provider}</dd></div><div><dt>Two-step verification</dt><dd><span className={profile.mfaEnabled?"profile-badge enabled":"profile-badge"}>{profile.mfaEnabled?"Enabled":"Not enabled"}</span></dd></div></dl>
                <div className="profile-stats"><div><Trophy size={24}/><strong>{profile.best.toLocaleString()}</strong><span>Best score</span></div><div><Coins size={24}/><strong>{profile.coins.toLocaleString()}</strong><span>Coins</span></div><div><Gamepad2 size={24}/><strong>{profile.games.toLocaleString()}</strong><span>Games completed</span></div></div>
                <button className="secondary full" onClick={()=>setSecurity(true)}><LockKeyhole size={18}/> Account security</button><Link className="primary full profile-play" href="/?view=menu">Continue to game</Link>
            </>}
        </section>
        {security&&profile&&<SecurityPanel onClose={()=>{setSecurity(false);void load()}}/>}
    </main>;
}
