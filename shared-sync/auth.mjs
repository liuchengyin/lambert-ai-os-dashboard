export const SESSION_KEY='lambert_auth_v1';
export function createAccount(client, {redirectTo,registrationClient}={}) {
  const result=async promise=>{const r=await promise;if(r.error)throw r.error;return r.data;};
  const registration=registrationClient;
  let verifiedEmail=null;
  return {
    client,
    session:async()=> (await result(client.auth.getSession())).session,
    verifiedUser:async()=> (await result(client.auth.getUser())).user,
    login:(email,password)=>result(client.auth.signInWithPassword({email:email.trim(),password})),
    register:(email,password)=>result(client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirectTo}})),
    sendRegistrationCode:async email=>{
      if(!registration)throw Error('registration_client_required');
      await result(registration.auth.signOut({scope:'local'}));verifiedEmail=null;
      const bytes=crypto.getRandomValues(new Uint8Array(32));
      const password='La!9'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
      const data=await result(registration.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirectTo}}));
      if(data.session){await result(registration.auth.signOut({scope:'local'}));throw {code:'confirmation_required'};}
      return data;
    },
    completeRegistration:async(email,token,password)=>{
      if(!registration)throw Error('registration_client_required');
      email=email.trim();
      if(verifiedEmail!==email){
        const data=await result(registration.auth.verifyOtp({email,token:token.trim(),type:'signup'}));
        if(!data.session||data.user?.email?.toLowerCase()!==email.toLowerCase())throw Error('registration_identity_mismatch');
        verifiedEmail=email;
      }
      // This separate in-memory session never enables workspace sync. Retain it only
      // to retry a failed password update without reusing an already-consumed OTP.
      await result(registration.auth.updateUser({password}));
      await result(registration.auth.signOut({scope:'local'}));verifiedEmail=null;
    },
    reset:email=>result(client.auth.resetPasswordForEmail(email.trim(),{redirectTo})),
    resend:email=>result(client.auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:redirectTo}})),
    changePassword:password=>result(client.auth.updateUser({password})),
    logout:()=>result(client.auth.signOut({scope:'local'})),
    subscribe:fn=>client.auth.onAuthStateChange((event,session)=>fn(event,session)),
  };
}
export function friendlyAuthError(error) {
  const code=error?.code;
  if(code==='invalid_credentials')return '邮箱或密码不正确，请重试。';
  if(code==='email_not_confirmed')return '邮箱尚未验证，请到注册页面获取验证码。';
  if(code==='confirmation_required')return '邮箱确认未开启，请联系管理员检查配置。';
  if(code==='user_already_exists')return '该邮箱已注册，请返回登录或找回密码。';
  if(code==='weak_password')return '密码强度不足，请使用更长的密码。';
  if(code==='over_email_send_rate_limit'||error?.status===429)return '操作过于频繁，请稍后再试。';
  if(code==='otp_expired'||code==='flow_state_expired')return '验证码或验证链接无效、已过期，请重新获取。';
  return '操作未完成，请检查网络后重试。';
}
