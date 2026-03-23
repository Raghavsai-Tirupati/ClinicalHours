import React, { Component, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  tabName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Lightweight error boundary for individual admin dashboard tabs.
 * Prevents one tab crash from taking down the entire dashboard.
 */
export class TabErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`[Admin Tab${this.props.tabName ? `: ${this.props.tabName}` : ""}] Error:`, error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              {this.props.tabName ? `${this.props.tabName} failed to load` : "Something went wrong"}
            </CardTitle>
            <CardDescription>
              An error occurred while loading this section. This is usually temporary.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {import.meta.env.DEV && this.state.error && (
              <p className="text-xs font-mono text-muted-foreground mb-3 break-all">
                {this.state.error.message}
              </p>
            )}
            <Button onClick={this.handleRetry} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
