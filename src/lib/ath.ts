import CryptoJS from 'crypto-js'
import { supabase } from './supabase'

const ATH_KEY = '4FF00D796327003AE0637E016699203B'

function decryptAth(source: string): Record<string, string> | null {
  try {
    const keyBytes = CryptoJS.enc.Utf8.parse(ATH_KEY)
    const iv = CryptoJS.MD5(keyBytes)
    const decrypted = CryptoJS.AES.decrypt(source, keyBytes, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    })
    const plainText = decrypted.toString(CryptoJS.enc.Utf8)
    if (!plainText) return null

    const params: Record<string, string> = {}
    new URLSearchParams(plainText).forEach((v, k) => { params[k] = v })
    return params
  } catch {
    return null
  }
}

export function logAthParams(): void {
  alert('[URL] ' + window.location.href)

  const ath = new URLSearchParams(window.location.search).get('ath')
  if (!ath) return

  const params = decryptAth(ath)
  if (!params) { alert('[ath] 解密失敗'); return }

  alert('[ath] 解密成功\n' + JSON.stringify(params, null, 2))

  supabase.from('ath_logs').insert({
    u_user_id:    params['U_USER_ID']    ?? null,
    u_user_name:  params['U_USER_NAME']  ?? null,
    u_store_no:   params['U_STORE_NO']   ?? null,
    u_store_name: params['U_STORE_NAME'] ?? null,
    u_func_id:    params['U_FUNC_ID']    ?? null,
    u_role_id:    params['U_ROLE_ID']    ?? null,
    u_store_list: params['U_STORE_LIST'] ?? null,
    session_uuid: params['SESSION_UUID'] ?? null,
    device_uuid:  params['DEVICE_UUID']  ?? null,
    os_type:      params['OS_TYPE']      ?? null,
    params,
  }).then(({ error }) => {
    if (error) alert('[ath] insert 失敗\n' + JSON.stringify(error))
    else alert('[ath] insert 成功')
  })
}
