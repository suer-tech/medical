import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Microscope, Plus, Eye, Brain, Scan, LogOut, Loader2, FileText } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const STUDY_TYPES = [
  {
    id: "retinal_scan",
    title: "Сканирование сетчатки",
    description: "Анализ состояния сетчатки глаза, выявление патологий сосудов и макулярной области",
    icon: Eye,
    color: "bg-blue-500",
  },
  {
    id: "optic_nerve",
    title: "Анализ зрительного нерва",
    description: "Оценка диска зрительного нерва, выявление признаков глаукомы и атрофии",
    icon: Brain,
    color: "bg-purple-500",
  },
  {
    id: "macular_analysis",
    title: "Анализ макулярной области",
    description: "Детальное исследование макулы, выявление дегенеративных изменений",
    icon: Scan,
    color: "bg-green-500",
  },
] as const;

const STATUS_LABELS = {
  draft: { label: "Черновик", color: "bg-gray-500" },
  analyzing: { label: "Анализ...", color: "bg-yellow-500" },
  completed: { label: "Завершено", color: "bg-green-500" },
  error: { label: "Ошибка", color: "bg-red-500" },
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: studies, isLoading, refetch } = useQuery({
    queryKey: ["studies"],
    queryFn: () => api.studies.list(),
  });

  const createStudyMutation = useMutation({
    mutationFn: (data: { title: string; studyType: string }) => api.studies.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies"] });
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleCreateStudy = async () => {
    if (!selectedType) return;

    setIsCreating(true);
    try {
      const studyType = STUDY_TYPES.find((t) => t.id === selectedType);
      const result = await createStudyMutation.mutateAsync({
        title: `${studyType?.title} - ${new Date().toLocaleDateString("ru-RU")}`,
        studyType: selectedType,
      });

      toast.success("Исследование создано");
      setIsCreateDialogOpen(false);
      setSelectedType(null);
      navigate(`/new-study?id=${result.id}`);
    } catch (error) {
      toast.error("Ошибка при создании исследования");
    } finally {
      setIsCreating(false);
    }
  };

  const getStudyTypeInfo = (type: string) => {
    return STUDY_TYPES.find((t) => t.id === type) || STUDY_TYPES[0];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Microscope className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Medical AI X-Ray</h1>
                <p className="text-sm text-muted-foreground">Панель управления</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Выход
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Мои исследования</h2>
            <p className="text-muted-foreground">
              Управляйте своими медицинскими исследованиями и анализами
            </p>
          </div>
          <Button size="lg" onClick={() => setIsCreateDialogOpen(true)} className="shadow-lg">
            <Plus className="h-5 w-5 mr-2" />
            Создать исследование
          </Button>
        </div>

        {/* Studies Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : studies && studies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studies.map((study) => {
              const typeInfo = getStudyTypeInfo(study.studyType);
              const statusInfo = STATUS_LABELS[study.status];
              const Icon = typeInfo.icon;

              return (
                <Card
                  key={study.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer group"
                  onClick={() => {
                    if (study.status === "draft") {
                      navigate(`/new-study?id=${study.id}`);
                    } else {
                      navigate(`/study/${study.id}`);
                    }
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div className={`${typeInfo.color} p-2 rounded-lg`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <Badge className={`${statusInfo.color} text-white`}>{statusInfo.label}</Badge>
                    </div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {study.title}
                    </CardTitle>
                    <CardDescription>{typeInfo.description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="text-sm text-muted-foreground">
                    <FileText className="h-4 w-4 mr-1" />
                    {new Date(study.createdAt).toLocaleDateString("ru-RU", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="py-20">
            <CardContent className="text-center">
              <div className="bg-muted/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Нет исследований</h3>
              <p className="text-muted-foreground mb-6">
                Создайте первое исследование для начала работы с системой
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Создать исследование
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Create Study Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Выберите тип исследования</DialogTitle>
            <DialogDescription>
              Выберите один из доступных типов анализа медицинских изображений
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {STUDY_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;

              return (
                <Card
                  key={type.id}
                  className={`cursor-pointer transition-all ${
                    isSelected ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md"
                  }`}
                  onClick={() => setSelectedType(type.id)}
                >
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className={`${type.color} p-3 rounded-lg`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{type.title}</CardTitle>
                        <CardDescription>{type.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateStudy} disabled={!selectedType || isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Создать
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
