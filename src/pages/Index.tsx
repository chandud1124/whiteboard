import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl">Collaborative Whiteboard</CardTitle>
          <CardDescription>Draw and collaborate in real-time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            size="lg"
            className="w-full"
            onClick={() => navigate("/login")}
          >
            Sign In
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => navigate("/signup")}
          >
            Create Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
