/**
 * Alert Rules Configuration Page
 * Configure anomaly detection rules and thresholds
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AlertTriangle,
  DollarSign,
  MapPin,
  Scan,
  Eye,
  Clock,
  Shield,
  Bell,
  Lock,
  Info,
  Save,
  RotateCcw,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

interface AlertRule {
  id: string;
  name: string;
  description: string;
  category: "amount" | "location" | "biometric" | "behavior" | "environment";
  enabled: boolean;
  severity: "low" | "medium" | "high" | "critical";
  action: "notify" | "alert" | "warn" | "lock";
  threshold?: number;
  config: Record<string, any>;
}

export default function AlertRules() {
  const [selectedMerchantId, setSelectedMerchantId] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: merchants } = trpc.merchants.getMyMerchants.useQuery();

  useMemo(() => {
    if (merchants && merchants.length > 0 && !selectedMerchantId) {
      setSelectedMerchantId(merchants[0].id);
    }
  }, [merchants, selectedMerchantId]);

  // Default alert rules configuration
  const [rules, setRules] = useState<AlertRule[]>([
    {
      id: "high_amount",
      name: "High Transaction Amount",
      description: "Alert when transaction exceeds user's average by threshold",
      category: "amount",
      enabled: true,
      severity: "high",
      action: "warn",
      threshold: 300, // Percentage above average
      config: {
        multiplier: 3.0,
        minAmount: 10000, // $100 in cents
      },
    },
    {
      id: "single_large_amount",
      name: "Single Large Transaction",
      description: "Alert for transactions above absolute threshold",
      category: "amount",
      enabled: true,
      severity: "critical",
      action: "lock",
      threshold: 50000, // $500 in cents
      config: {
        requireAppUnlock: true,
      },
    },
    {
      id: "rapid_transactions",
      name: "Rapid Consecutive Transactions",
      description: "Multiple transactions within short time period",
      category: "behavior",
      enabled: true,
      severity: "medium",
      action: "alert",
      threshold: 3, // Number of transactions
      config: {
        timeWindow: 300, // 5 minutes in seconds
      },
    },
    {
      id: "unusual_device",
      name: "Unusual Device Location",
      description: "Transaction from new or unusual device",
      category: "location",
      enabled: true,
      severity: "medium",
      action: "alert",
      config: {
        checkHistory: true,
        daysToCheck: 30,
      },
    },
    {
      id: "low_face_confidence",
      name: "Low Face Recognition Confidence",
      description: "Face match confidence below threshold",
      category: "biometric",
      enabled: true,
      severity: "high",
      action: "warn",
      threshold: 70, // Percentage
      config: {
        minConfidence: 0.7,
        requireRetry: true,
      },
    },
    {
      id: "multiple_face_failures",
      name: "Multiple Face Recognition Failures",
      description: "Repeated face recognition failures",
      category: "biometric",
      enabled: true,
      severity: "critical",
      action: "lock",
      threshold: 3, // Number of failures
      config: {
        timeWindow: 600, // 10 minutes
        requireAppUnlock: true,
      },
    },
    {
      id: "poor_lighting",
      name: "Poor Lighting Conditions",
      description: "Face captured in poor lighting",
      category: "environment",
      enabled: true,
      severity: "low",
      action: "notify",
      config: {
        checkBrightness: true,
        minBrightness: 0.3,
      },
    },
    {
      id: "face_obstruction",
      name: "Face Obstruction Detected",
      description: "Face partially covered or obstructed",
      category: "environment",
      enabled: true,
      severity: "medium",
      action: "alert",
      config: {
        checkObstruction: true,
        maxObstructionPercent: 20,
      },
    },
    {
      id: "unusual_time",
      name: "Unusual Transaction Time",
      description: "Transaction outside normal hours",
      category: "behavior",
      enabled: false,
      severity: "low",
      action: "notify",
      config: {
        startHour: 22, // 10 PM
        endHour: 6, // 6 AM
      },
    },
    {
      id: "daily_limit_exceeded",
      name: "Daily Transaction Limit Exceeded",
      description: "Total daily transactions exceed limit",
      category: "amount",
      enabled: true,
      severity: "high",
      action: "warn",
      threshold: 100000, // $1000 in cents
      config: {
        dailyLimit: 100000,
        requireAppUnlock: true,
      },
    },
  ]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "amount":
        return DollarSign;
      case "location":
        return MapPin;
      case "biometric":
        return Scan;
      case "behavior":
        return Clock;
      case "environment":
        return Eye;
      default:
        return AlertTriangle;
    }
  };

  const getActionInfo = (action: string) => {
    switch (action) {
      case "notify":
        return {
          label: "Notify",
          description: "仅记录和显示通知",
          icon: Bell,
          color: "text-blue-500",
        };
      case "alert":
        return {
          label: "Alert",
          description: "发送提醒通知",
          icon: AlertTriangle,
          color: "text-yellow-500",
        };
      case "warn":
        return {
          label: "Warn",
          description: "需要用户确认",
          icon: Shield,
          color: "text-orange-500",
        };
      case "lock":
        return {
          label: "Lock",
          description: "锁定交易，需要APP解锁",
          icon: Lock,
          color: "text-red-500",
        };
      default:
        return {
          label: "Unknown",
          description: "",
          icon: Info,
          color: "text-gray-500",
        };
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleToggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
    setHasChanges(true);
  };

  const handleUpdateRule = (ruleId: string, updates: Partial<AlertRule>) => {
    setRules((prev) =>
      prev.map((rule) => (rule.id === ruleId ? { ...rule, ...updates } : rule))
    );
    setHasChanges(true);
  };

  const handleSaveRules = () => {
    toast.success("Alert rules saved successfully");
    setHasChanges(false);
    // TODO: Call tRPC mutation to save rules
  };

  const handleResetRules = () => {
    toast.info("Alert rules reset to defaults");
    setHasChanges(false);
    // TODO: Reset to default or saved values
  };

  const groupedRules = useMemo(() => {
    return rules.reduce((acc, rule) => {
      if (!acc[rule.category]) {
        acc[rule.category] = [];
      }
      acc[rule.category].push(rule);
      return acc;
    }, {} as Record<string, AlertRule[]>);
  }, [rules]);

  const categoryLabels = {
    amount: "金额异常",
    location: "地点异常",
    biometric: "生物识别异常",
    behavior: "行为异常",
    environment: "环境异常",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Alert Rules</h1>
            <p className="text-muted-foreground">
              Configure anomaly detection rules and thresholds
            </p>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button variant="outline" onClick={handleResetRules}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            )}
            <Button onClick={handleSaveRules} disabled={!hasChanges}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>

        {/* Merchant Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Merchant</CardTitle>
            <CardDescription>Select merchant to configure rules</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedMerchantId?.toString()}
              onValueChange={(value) => setSelectedMerchantId(parseInt(value))}
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Select merchant" />
              </SelectTrigger>
              <SelectContent>
                {merchants?.map((merchant) => (
                  <SelectItem key={merchant.id} value={merchant.id.toString()}>
                    {merchant.businessName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Action Levels Info */}
        <Card>
          <CardHeader>
            <CardTitle>Action Levels</CardTitle>
            <CardDescription>Understanding alert action types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {["notify", "alert", "warn", "lock"].map((action) => {
                const info = getActionInfo(action);
                const Icon = info.icon;
                return (
                  <div key={action} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Icon className={`h-5 w-5 ${info.color} flex-shrink-0 mt-0.5`} />
                    <div>
                      <p className="font-medium">{info.label}</p>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Rules by Category */}
        <Accordion type="multiple" defaultValue={Object.keys(groupedRules)} className="space-y-4">
          {Object.entries(groupedRules).map(([category, categoryRules]) => {
            const Icon = getCategoryIcon(category);
            const enabledCount = categoryRules.filter((r) => r.enabled).length;

            return (
              <AccordionItem key={category} value={category} className="border rounded-lg">
                <Card>
                  <AccordionTrigger className="px-6 hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div className="text-left">
                          <h3 className="font-semibold">
                            {categoryLabels[category as keyof typeof categoryLabels]}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {enabledCount} of {categoryRules.length} rules enabled
                          </p>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <CardContent className="pt-4 space-y-4">
                      {categoryRules.map((rule) => {
                        const actionInfo = getActionInfo(rule.action);
                        const ActionIcon = actionInfo.icon;

                        return (
                          <Card key={rule.id} className={!rule.enabled ? "opacity-60" : ""}>
                            <CardContent className="p-4 space-y-4">
                              {/* Rule Header */}
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium">{rule.name}</h4>
                                    <Badge className={getSeverityColor(rule.severity)}>
                                      {rule.severity.toUpperCase()}
                                    </Badge>
                                    <Badge variant="outline" className={actionInfo.color}>
                                      <ActionIcon className="h-3 w-3 mr-1" />
                                      {actionInfo.label}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {rule.description}
                                  </p>
                                </div>
                                <Switch
                                  checked={rule.enabled}
                                  onCheckedChange={() => handleToggleRule(rule.id)}
                                />
                              </div>

                              {rule.enabled && (
                                <>
                                  <Separator />

                                  {/* Rule Configuration */}
                                  <div className="space-y-4">
                                    {/* Severity */}
                                    <div className="space-y-2">
                                      <Label>Severity Level</Label>
                                      <Select
                                        value={rule.severity}
                                        onValueChange={(value) =>
                                          handleUpdateRule(rule.id, {
                                            severity: value as any,
                                          })
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="low">Low</SelectItem>
                                          <SelectItem value="medium">Medium</SelectItem>
                                          <SelectItem value="high">High</SelectItem>
                                          <SelectItem value="critical">Critical</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {/* Action */}
                                    <div className="space-y-2">
                                      <Label>Action Type</Label>
                                      <Select
                                        value={rule.action}
                                        onValueChange={(value) =>
                                          handleUpdateRule(rule.id, { action: value as any })
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="notify">
                                            Notify - 仅记录
                                          </SelectItem>
                                          <SelectItem value="alert">
                                            Alert - 发送提醒
                                          </SelectItem>
                                          <SelectItem value="warn">
                                            Warn - 需要确认
                                          </SelectItem>
                                          <SelectItem value="lock">
                                            Lock - 需要APP解锁
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <p className="text-xs text-muted-foreground">
                                        {actionInfo.description}
                                      </p>
                                    </div>

                                    {/* Threshold (if applicable) */}
                                    {rule.threshold !== undefined && (
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <Label>Threshold</Label>
                                          <span className="text-sm font-medium">
                                            {rule.id.includes("amount")
                                              ? `$${(rule.threshold / 100).toFixed(2)}`
                                              : rule.id.includes("confidence")
                                              ? `${rule.threshold}%`
                                              : rule.threshold}
                                          </span>
                                        </div>
                                        <Slider
                                          value={[rule.threshold]}
                                          onValueChange={([value]) =>
                                            handleUpdateRule(rule.id, { threshold: value })
                                          }
                                          min={
                                            rule.id.includes("amount")
                                              ? 1000
                                              : rule.id.includes("confidence")
                                              ? 50
                                              : 1
                                          }
                                          max={
                                            rule.id.includes("amount")
                                              ? 100000
                                              : rule.id.includes("confidence")
                                              ? 100
                                              : 10
                                          }
                                          step={
                                            rule.id.includes("amount")
                                              ? 1000
                                              : rule.id.includes("confidence")
                                              ? 5
                                              : 1
                                          }
                                        />
                                      </div>
                                    )}

                                    {/* App Unlock Required */}
                                    {rule.config.requireAppUnlock !== undefined && (
                                      <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                                        <div className="flex items-center gap-2">
                                          <Lock className="h-4 w-4 text-red-500" />
                                          <Label>Require APP Unlock</Label>
                                        </div>
                                        <Switch
                                          checked={rule.config.requireAppUnlock}
                                          onCheckedChange={(checked) =>
                                            handleUpdateRule(rule.id, {
                                              config: {
                                                ...rule.config,
                                                requireAppUnlock: checked,
                                              },
                                            })
                                          }
                                        />
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Save Reminder */}
        {hasChanges && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              You have unsaved changes. Click "Save Changes" to apply your configuration.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </DashboardLayout>
  );
}
