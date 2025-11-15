import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Monitor,
  Smartphone,
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  Activity,
} from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";

export default function LoginHistory() {
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  // Fetch login history
  const { data: historyData, isLoading } = trpc.auth.getLoginHistory.useQuery({
    limit,
    offset: page * limit,
    status: filter !== "all" ? filter : undefined,
  });

  // Fetch statistics
  const { data: stats } = trpc.auth.getLoginStatistics.useQuery({
    days: 30,
  });

  // Fetch suspicious activity
  const { data: suspicious } = trpc.auth.detectSuspiciousActivity.useQuery();

  const getDeviceIcon = (userAgent: string) => {
    if (!userAgent) return <Monitor className="h-5 w-5" />;
    if (userAgent.toLowerCase().includes("mobile")) {
      return <Smartphone className="h-5 w-5" />;
    }
    return <Monitor className="h-5 w-5" />;
  };

  const getLoginMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      email: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      face: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      oauth: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[method] || colors.email}`}>
        {method || "unknown"}
      </span>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Login History</h1>
        <p className="text-muted-foreground mt-1">
          Monitor your account security and login activities
        </p>
      </div>

      {/* Suspicious Activity Alert */}
      {suspicious?.isSuspicious && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Suspicious Activity Detected!</strong>
            <ul className="mt-2 list-disc list-inside">
              {suspicious.reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logins</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLogins || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.period}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.successRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {stats?.successfulLogins || 0} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Devices</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.uniqueDevices || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.uniqueIps || 0} IP addresses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.uniqueLocations || 0}</div>
            <p className="text-xs text-muted-foreground">Different locations</p>
          </CardContent>
        </Card>
      </div>

      {/* Login Methods Distribution */}
      {stats?.byMethod && Object.keys(stats.byMethod).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Login Methods</CardTitle>
            <CardDescription>Distribution of authentication methods used</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {Object.entries(stats.byMethod).map(([method, count]) => (
                <div key={method} className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium capitalize">{method}</span>
                    <span className="text-sm text-muted-foreground">{count}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2"
                      style={{
                        width: `${((count as number) / (stats.totalLogins || 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Login Activity</CardTitle>
              <CardDescription>
                Showing {historyData?.data.length || 0} of {historyData?.total || 0} records
              </CardDescription>
            </div>
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Logins</SelectItem>
                <SelectItem value="success">Successful</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : historyData?.data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No login records found
            </div>
          ) : (
            <div className="space-y-4">
              {historyData?.data.map((login) => (
                <div
                  key={login.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {login.status === "success" ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {login.status === "success" ? "Successful Login" : "Failed Login"}
                        </span>
                        {getLoginMethodBadge(login.loginMethod || "unknown")}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(login.createdAt).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1">
                          {getDeviceIcon(login.userAgent || "")}
                          {login.userAgent?.substring(0, 30) || "Unknown device"}...
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {login.location || "Unknown location"}
                        </div>
                        <div>IP: {login.ipAddress || "Unknown"}</div>
                      </div>
                      {login.failureReason && (
                        <div className="text-sm text-red-500 mt-2">
                          Reason: {login.failureReason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {historyData && historyData.total > limit && (
            <div className="flex justify-between items-center mt-6">
              <Button
                variant="outline"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {Math.ceil(historyData.total / limit)}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={(page + 1) * limit >= historyData.total}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Review your login history regularly for suspicious activity</li>
            <li>• Enable two-factor authentication for added security</li>
            <li>• Use unique, strong passwords for your account</li>
            <li>• Be cautious of logins from unfamiliar locations or devices</li>
            <li>• Report any unauthorized access immediately</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
