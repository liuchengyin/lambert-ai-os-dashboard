export const SESSION_KEY='lambert_auth_v1';
export function createAccount(client, {redirectTo}={}) {
  const result=async promise=>{const r=await promise;if(r.error)throw r.error;return r.data;};
  return {
    client,
    session:async()=> (await result(client.auth.getSession())).session,
    verifiedUser:async()=> (await result(client.auth.getUser())).user,
    login:(email,password)=>result(client.auth.signInWithPassword({email:email.trim(),password})),
    register:(email,password)=>result(client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirectTo}})),
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
  if(code==='email_not_confirmed')return '请先打开邮箱中的验证链接，再登录。';
  if(code==='weak_password')return '密码强度不足，请使用更长的密码。';
  if(code==='over_email_send_rate_limit'||error?.status===429)return '操作过于频繁，请稍后再试。';
  if(code==='otp_expired'||code==='flow_state_expired')return '链接已失效，请重新发送邮件。';
  return '操作未完成，请检查网络后重试。';
}
