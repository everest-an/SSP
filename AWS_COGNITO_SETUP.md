# AWS Cognito OAuth配置指南

## 已完成的配置

### 1. Cognito用户池创建 ✅
- **User Pool Name**: User pool - aua8rd  
- **Region**: ap-southeast-2 (Sydney)
- **App Client Name**: SSP
- **App Client ID**: `3vdjmnldb67uu2jnuqt3uhaqth`

### 2. OAuth设置 ✅
- **Cognito Domain**: `ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com`
- **Callback URL**: `https://ssp.click/api/oauth/callback`
- **Sign-in Method**: Email
- **Self-registration**: Enabled

### 3. 登录页面 ✅
托管登录页面URL:
```
https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com/login?client_id=3vdjmnldb67uu2jnuqt3uhaqth&response_type=code&scope=email+openid+phone&redirect_uri=https%3A%2F%2Fssp.click%2Fapi%2Foauth%2Fcallback
```

## 部署步骤

### 步骤1: 获取User Pool ID

1. 登录AWS控制台
2. 进入Cognito服务
3. 点击"User pools"
4. 找到"User pool - aua8rd"
5. 复制User Pool ID (格式: `ap-southeast-2_xxxxxxxxx`)

### 步骤2: 配置环境变量

SSH连接到EC2服务器:
```bash
ssh -i ssp-key.pem ec2-user@3.25.163.9
```

进入项目目录并创建`.env`文件:
```bash
cd /path/to/SSP
nano .env
```

添加以下配置:
```bash
# OAuth Configuration (AWS Cognito)
VITE_OAUTH_PORTAL_URL=https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com
VITE_APP_ID=3vdjmnldb67uu2jnuqt3uhaqth
VITE_APP_TITLE=SSP - Smart Store Payment

# Cognito Backend Configuration
COGNITO_USER_POOL_ID=ap-southeast-2_xxxxxxxxx  # 替换为实际的User Pool ID
COGNITO_REGION=ap-southeast-2
COGNITO_DOMAIN=ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com

# 其他必需的环境变量...
DATABASE_URL=mysql://user:password@localhost:3306/ssp
JWT_SECRET=your_jwt_secret_key_here
# ... (参考.env.example)
```

### 步骤3: 更新GitHub并部署

提交更改到GitHub:
```bash
git pull origin main
pnpm install
pnpm run build
```

重启服务:
```bash
# 如果使用PM2
pm2 restart ssp

# 如果使用systemd
sudo systemctl restart ssp
```

### 步骤4: 测试登录功能

1. 访问 https://ssp.click
2. 点击"Sign In"按钮
3. 应该跳转到Cognito托管登录页面
4. 输入邮箱并注册/登录
5. 登录成功后应该返回到ssp.click

## OAuth端点信息

如果需要自定义OAuth流程,以下是完整的端点信息:

- **Authorization Endpoint**:  
  `https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com/oauth2/authorize`

- **Token Endpoint**:  
  `https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com/oauth2/token`

- **UserInfo Endpoint**:  
  `https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com/oauth2/userInfo`

- **Logout Endpoint**:  
  `https://ap-southeast-2q83puda94.auth.ap-southeast-2.amazoncognito.com/logout`

## 代码集成示例

### 前端登录跳转 (已在代码中实现)

```typescript
// client/src/const.ts
export const getLoginUrl = () => {
  const portalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  
  return `${portalUrl}/oauth2/authorize?client_id=${appId}&response_type=code&scope=email+openid+phone&redirect_uri=${encodeURIComponent(redirectUri)}`;
};
```

### 后端Token验证 (需要实现)

```javascript
// server/routes/oauth.js
const { CognitoJwtVerifier } = require("aws-jwt-verify");

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: "access",
  clientId: process.env.VITE_APP_ID,
});

app.get("/api/oauth/callback", async (req, res) => {
  const { code } = req.query;
  
  // 1. 用code换取token
  const tokenResponse = await fetch(
    `${process.env.VITE_OAUTH_PORTAL_URL}/oauth2/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.VITE_APP_ID,
        code: code,
        redirect_uri: `${req.protocol}://${req.get("host")}/api/oauth/callback`,
      }),
    }
  );
  
  const tokens = await tokenResponse.json();
  
  // 2. 验证token
  const payload = await verifier.verify(tokens.access_token);
  
  // 3. 获取用户信息
  const userInfoResponse = await fetch(
    `${process.env.VITE_OAUTH_PORTAL_URL}/oauth2/userInfo`,
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  );
  
  const userInfo = await userInfoResponse.json();
  
  // 4. 创建session或JWT
  req.session.user = userInfo;
  
  res.redirect("/");
});
```

## 故障排查

### 问题1: 登录后跳转404
**原因**: 后端没有实现 `/api/oauth/callback` 路由  
**解决**: 实现OAuth回调处理逻辑

### 问题2: Token验证失败
**原因**: User Pool ID配置错误  
**解决**: 从AWS控制台确认正确的User Pool ID

### 问题3: CORS错误
**原因**: Cognito域名未添加到CORS白名单  
**解决**: 在服务器配置中添加Cognito域名

## 安全建议

1. **启用MFA**: 在Cognito控制台为用户池启用多因素认证
2. **配置密码策略**: 设置强密码要求
3. **启用高级安全**: 开启Cognito的高级安全功能(检测异常登录)
4. **定期轮换密钥**: 如果使用Client Secret,定期更换
5. **监控日志**: 启用CloudWatch日志监控登录活动

## 成本估算

AWS Cognito定价(截至2025年):
- 前50,000 MAU (月活跃用户): 免费
- 超过50,000 MAU: $0.0055/MAU

对于中小型应用,Cognito基本免费使用。

## 相关资源

- [AWS Cognito文档](https://docs.aws.amazon.com/cognito/)
- [OAuth 2.0规范](https://oauth.net/2/)
- [OpenID Connect](https://openid.net/connect/)
