# 前端集成指南

本文档指导如何将所有后端服务集成到现有前端页面。

## 目录

1. [面部识别集成](#面部识别集成)
2. [实时推送集成](#实时推送集成)
3. [用户账户集成](#用户账户集成)
4. [支付方式集成](#支付方式集成)
5. [数据分析集成](#数据分析集成)
6. [国际化集成](#国际化集成)

---

## 面部识别集成

### 在 FaceRegistration.tsx 中集成

```typescript
import { useFaceRecognition } from '@/hooks/useFaceRecognition';

export function FaceRegistration() {
  const {
    isInitialized,
    isDetecting,
    detectionResult,
    enrollUser,
    verifyUser,
    error,
  } = useFaceRecognition();

  const handleEnroll = async () => {
    try {
      // 采集5个样本
      const result = await enrollUser('user123', 5);
      if (result.success) {
        console.log('Face enrollment successful');
      }
    } catch (error) {
      console.error('Enrollment failed:', error);
    }
  };

  return (
    <div>
      {/* 摄像头容器 */}
      <video ref={videoRef} />
      
      {/* 检测结果 */}
      {detectionResult && (
        <div>
          <p>Face Quality: {detectionResult.quality}</p>
          <p>Liveness Score: {detectionResult.livenessScore}</p>
        </div>
      )}
      
      {/* 注册按钮 */}
      <button onClick={handleEnroll}>
        {isDetecting ? 'Detecting...' : 'Enroll Face'}
      </button>
    </div>
  );
}
```

### 在 DevicePayment.tsx 中集成

```typescript
import { useFaceRecognition } from '@/hooks/useFaceRecognition';

export function DevicePayment() {
  const { verifyUser } = useFaceRecognition();

  const handlePayment = async () => {
    try {
      // 验证用户
      const result = await verifyUser('user123');
      
      if (result.verified) {
        // 创建订单
        await createOrder({
          userId: 'user123',
          items: [...],
        });
      } else {
        console.error('Face verification failed');
      }
    } catch (error) {
      console.error('Payment failed:', error);
    }
  };

  return (
    <div>
      <button onClick={handlePayment}>Pay with Face</button>
    </div>
  );
}
```

---

## 实时推送集成

### 在 Dashboard.tsx 中集成

```typescript
import { useRealtimePush, EventType } from '@/hooks/useRealtimePush';

export function Dashboard() {
  const { connected, lastEvent, on, off } = useRealtimePush({
    userId: currentUser.id,
    merchantId: currentMerchant.id,
    events: [
      EventType.ORDER_CREATED,
      EventType.ORDER_COMPLETED,
      EventType.PAYMENT_SUCCESS,
    ],
  });

  useEffect(() => {
    // 订阅订单创建事件
    const unsubscribe = on(EventType.ORDER_CREATED, (event) => {
      console.log('New order:', event.data);
      // 更新UI
      updateOrderList();
    });

    return unsubscribe;
  }, [on]);

  return (
    <div>
      <p>Connection: {connected ? 'Connected' : 'Disconnected'}</p>
      {lastEvent && (
        <p>Last Event: {lastEvent.type}</p>
      )}
    </div>
  );
}
```

---

## 用户账户集成

### 在 UserProfile.tsx 中集成

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';

export function UserProfile() {
  const { data: profile } = useQuery({
    queryKey: ['user', 'profile'],
    queryFn: () => trpc.user.getProfile.query(),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data) => trpc.user.updateProfile.mutate(data),
    onSuccess: () => {
      // 更新缓存
      queryClient.invalidateQueries({ queryKey: ['user', 'profile'] });
    },
  });

  return (
    <div>
      <h2>{profile?.name}</h2>
      <p>{profile?.email}</p>
      
      <button onClick={() => updateProfileMutation.mutate({
        name: 'New Name',
      })}>
        Update Profile
      </button>
    </div>
  );
}
```

---

## 支付方式集成

### 在 PaymentMethods.tsx 中集成

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';

export function PaymentMethods() {
  const { data: methods } = useQuery({
    queryKey: ['payment', 'methods'],
    queryFn: () => trpc.payment.getMethods.query(),
  });

  const addMethodMutation = useMutation({
    mutationFn: (data) => trpc.payment.addMethod.mutate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', 'methods'] });
    },
  });

  return (
    <div>
      {methods?.map(method => (
        <div key={method.id}>
          <p>{method.name}</p>
          {method.isDefault && <span>Default</span>}
        </div>
      ))}
      
      <button onClick={() => addMethodMutation.mutate({
        type: 'credit_card',
        name: 'My Card',
      })}>
        Add Payment Method
      </button>
    </div>
  );
}
```

---

## 数据分析集成

### 在 Analytics.tsx 中集成

```typescript
import { useQuery } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';

export function Analytics() {
  const { data: revenue } = useQuery({
    queryKey: ['analytics', 'revenue'],
    queryFn: () => trpc.analytics.getRevenue.query(),
  });

  const { data: products } = useQuery({
    queryKey: ['analytics', 'products'],
    queryFn: () => trpc.analytics.getProductPopularity.query(),
  });

  return (
    <div>
      <h2>Revenue: ${revenue?.totalRevenue}</h2>
      <p>Orders: {revenue?.totalOrders}</p>
      
      <h3>Top Products</h3>
      {products?.map(product => (
        <div key={product.productId}>
          <p>{product.productName}: {product.totalSold} sold</p>
        </div>
      ))}
    </div>
  );
}
```

---

## 国际化集成

### 在 App.tsx 中集成

```typescript
import { useI18n } from '@/hooks/useI18n';
import { i18nService } from '@/lib/i18n';

export function App() {
  const { language, currency, setLanguage, setCurrency } = useI18n();

  return (
    <div>
      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
        {i18nService.getSupportedLanguages().map(lang => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeName}
          </option>
        ))}
      </select>

      <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
        {i18nService.getSupportedCurrencies().map(curr => (
          <option key={curr.code} value={curr.code}>
            {curr.name} ({curr.symbol})
          </option>
        ))}
      </select>
    </div>
  );
}
```

### 在任何组件中使用翻译

```typescript
import { useTranslation } from '@/hooks/useTranslation';

export function MyComponent() {
  const t = useTranslation();

  return (
    <div>
      <h1>{t('order.title')}</h1>
      <button>{t('common.save')}</button>
    </div>
  );
}
```

---

## 集成检查清单

- [ ] 在 FaceRegistration.tsx 中集成面部识别
- [ ] 在 DevicePayment.tsx 中集成面部验证
- [ ] 在 Dashboard.tsx 中集成实时推送
- [ ] 在 UserProfile.tsx 中集成用户账户
- [ ] 在 PaymentMethods.tsx 中集成支付方式
- [ ] 在 Analytics.tsx 中集成数据分析
- [ ] 在 App.tsx 中集成国际化
- [ ] 测试所有集成
- [ ] 更新类型定义
- [ ] 添加错误处理

---

## 常见问题

### Q: 如何处理加载状态？
A: 使用 React Query 的 `isLoading` 状态：
```typescript
const { data, isLoading, error } = useQuery(...);

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
```

### Q: 如何缓存数据？
A: React Query 会自动缓存，可以配置缓存时间：
```typescript
useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 5 * 60 * 1000, // 5分钟
});
```

### Q: 如何处理实时更新？
A: 使用 WebSocket 推送和 React Query 的 `setQueryData`：
```typescript
const queryClient = useQueryClient();

on(EventType.ORDER_CREATED, (event) => {
  queryClient.setQueryData(['orders'], (old) => [
    ...old,
    event.data,
  ]);
});
```
