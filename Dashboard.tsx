import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Microscope, Plus, Eye, Brain, Scan, LogOut, Loader2, FileText, Trash2, MessageSquare, ClipboardList, Activity, FlaskConical, ArrowLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { DIRECTIONS, TEMPLATES, Direction, Category, StudyOption } from "@/constants/directions";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

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
  {
    id: "free_query",
    title: "Свободный запрос",
    description: "Задайте любой вопрос к ИИ по загруженному изображению",
    icon: MessageSquare,
    color: "bg-orange-500",
  },
  {
    id: "template_form",
    title: "Заполнить форму по шаблону",
    description: "Загрузите изображение и заполните форму с полями для структурированного анализа",
    icon: ClipboardList,
    color: "bg-indigo-500",
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [currentDirection, setCurrentDirection] = useState<Direction | null>(null);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [expandedTemplateCategory, setExpandedTemplateCategory] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [studyToDelete, setStudyToDelete] = useState<number | null>(null);

  const { data: studies, isLoading, refetch } = useQuery({
    queryKey: ["studies"],
    queryFn: () => api.studies.list(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const createStudyMutation = useMutation({
    mutationFn: (data: { title: string; studyType: string }) => api.studies.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies"] });
    },
  });

  const deleteStudyMutation = useMutation({
    mutationFn: (id: number) => api.studies.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studies"] });
      toast.success("Исследование удалено");
      setStudyToDelete(null);
    },
    onError: () => {
      toast.error("Ошибка при удалении исследования");
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
      // Find study title from directions structure
      let studyTitle = selectedType;
      for (const direction of DIRECTIONS) {
        for (const category of direction.categories) {
          const study = category.studies.find((s) => s.id === selectedType);
          if (study) {
            studyTitle = study.title;
            break;
          }
        }
        if (studyTitle !== selectedType) break;
      }

      const result = await createStudyMutation.mutateAsync({
        title: `${studyTitle} - ${new Date().toLocaleDateString("ru-RU")}`,
        studyType: selectedType,
      });

      toast.success("Исследование создано");
      setIsCreateDialogOpen(false);
      const type = selectedType;
      const templateId = selectedTemplateId;
      setSelectedType(null);
      setSelectedTemplateId(null);
      setCurrentDirection(null);
      setCurrentCategory(null);
      navigate(`/new-study?id=${result.id}${type ? `&type=${type}` : ""}${templateId ? `&templateId=${templateId}` : ""}`);
    } catch (error) {
      toast.error("Ошибка при создании исследования");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDirectionSelect = (direction: Direction) => {
    setCurrentDirection(direction);
    setCurrentCategory(null);
    setSelectedType(null);
    setSelectedTemplateId(null);
  };

  const handleCategorySelect = (category: Category) => {
    setCurrentCategory(category);
    setSelectedType(null);
    setSelectedTemplateId(null);
  };

  const handleStudySelect = (study: StudyOption, categoryId: string) => {
    if (study.id === "template_form") {
      // Toggle template selection expansion
      if (expandedTemplateCategory === categoryId) {
        setExpandedTemplateCategory(null);
        setSelectedType(null);
        setSelectedTemplateId(null);
      } else {
        setExpandedTemplateCategory(categoryId);
        setSelectedType("template_form");
        setSelectedTemplateId(study.templateId || null);
      }
    } else {
      setSelectedType(study.id);
      setSelectedTemplateId(null);
      setExpandedTemplateCategory(null);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setSelectedType("template_form");
    // Keep the category expanded
  };

  const handleBack = () => {
    if (selectedTemplateId) {
      // Back from template selection to category
      setSelectedTemplateId(null);
      setSelectedType(null);
      setExpandedTemplateCategory(null);
    } else if (expandedTemplateCategory) {
      // Collapse template selection
      setExpandedTemplateCategory(null);
      setSelectedType(null);
    } else if (currentCategory) {
      // Back from category to direction
      setCurrentCategory(null);
      setSelectedType(null);
      setExpandedTemplateCategory(null);
    } else if (currentDirection) {
      // Back from direction to root
      setCurrentDirection(null);
      setExpandedTemplateCategory(null);
    }
  };

  const getStudyTypeInfo = (type: string) => {
    return STUDY_TYPES.find((t) => t.id === type) || STUDY_TYPES[0];
  };

  const handleDeleteClick = (e: React.MouseEvent, studyId: number) => {
    e.stopPropagation(); // Предотвращаем клик на карточку
    setStudyToDelete(studyId);
  };

  const handleConfirmDelete = () => {
    if (studyToDelete) {
      deleteStudyMutation.mutate(studyToDelete);
    }
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
                  className="hover:shadow-lg transition-shadow cursor-pointer group relative"
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
                      <div className="flex items-center gap-2">
                      <Badge className={`${statusInfo.color} text-white`}>{statusInfo.label}</Badge>
                        <button
                          onClick={(e) => handleDeleteClick(e, study.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-destructive/10 rounded-md text-destructive hover:text-destructive/80"
                          title="Удалить исследование"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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
      <Dialog 
        open={isCreateDialogOpen} 
        onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
          if (!open) {
            // Reset navigation state when closing
            setCurrentDirection(null);
            setCurrentCategory(null);
            setSelectedType(null);
            setSelectedTemplateId(null);
            setExpandedTemplateCategory(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Выберите тип исследования</DialogTitle>
            <DialogDescription>
              Выберите направление и тип исследования
            </DialogDescription>
          </DialogHeader>

          {/* Breadcrumb Navigation */}
          {(currentDirection || currentCategory || expandedTemplateCategory) && (
            <Breadcrumb className="mb-4">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink 
                    className="cursor-pointer"
                    onClick={() => {
                      setCurrentDirection(null);
                      setCurrentCategory(null);
                      setSelectedType(null);
                      setSelectedTemplateId(null);
                      setExpandedTemplateCategory(null);
                    }}
                  >
                    Направления
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {currentDirection && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {currentCategory || selectedTemplateId ? (
                        <BreadcrumbLink 
                          className="cursor-pointer"
                          onClick={handleBack}
                        >
                          {currentDirection.title}
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{currentDirection.title}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </>
                )}
                {currentCategory && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {selectedTemplateId ? (
                        <BreadcrumbLink 
                          className="cursor-pointer"
                          onClick={handleBack}
                        >
                          {currentCategory.title}
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{currentCategory.title}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          )}

          <div className="py-4">
            {/* Level 1: Directions */}
            {!currentDirection && !currentCategory && !selectedTemplateId && (
              <div className="space-y-3">
                {DIRECTIONS.map((direction) => {
                  const Icon = direction.icon;
                  return (
                    <Card
                      key={direction.id}
                      className="cursor-pointer transition-all hover:shadow-lg"
                      onClick={() => handleDirectionSelect(direction)}
                    >
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className={`${direction.color} p-4 rounded-lg`}>
                            <Icon className="h-8 w-8 text-white" />
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg">{direction.title}</CardTitle>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Level 2: Categories or Templates */}
            {currentDirection && !currentCategory && (
              <div className="space-y-4">
                {currentDirection.categories.map((category) => {
                  const isTemplateExpanded = expandedTemplateCategory === category.id;
                  const availableTemplates = Object.values(TEMPLATES).filter(
                    (t) => t.direction === currentDirection.id
                  );
                  
                  return (
                    <div key={category.id}>
                      <h3 className="text-lg font-semibold mb-3">{category.title}</h3>
                      <div className="space-y-3">
                        {category.studies.map((study) => {
                          const Icon = study.icon;
                          const isTemplateForm = study.id === "template_form";
                          const isSelected = selectedType === study.id && !isTemplateForm;
                          const isExpanded = isTemplateForm && isTemplateExpanded;
                          
                          return (
                            <div key={study.id} className="space-y-2">
                              <Card
                                className={`cursor-pointer transition-all ${
                                  isSelected || isExpanded
                                    ? "ring-2 ring-primary shadow-lg"
                                    : "hover:shadow-md"
                                } ${isTemplateForm ? "bg-indigo-50/50 border-indigo-200" : ""}`}
                                onClick={() => handleStudySelect(study, category.id)}
                              >
                                <CardHeader>
                                  <div className="flex items-start gap-3">
                                    <div className={`${study.color} p-2 rounded-lg`}>
                                      <Icon className="h-5 w-5 text-white" />
                                    </div>
                                    <div className="flex-1">
                                      <CardTitle className="text-base mb-1 flex items-center gap-2">
                                        {study.title}
                                        {isTemplateForm && (
                                          <span className="text-xs font-normal text-muted-foreground bg-indigo-100 px-2 py-0.5 rounded">
                                            {availableTemplates.length} шаблон{availableTemplates.length !== 1 ? "ов" : ""}
                                          </span>
                                        )}
                                      </CardTitle>
                                      {study.description && (
                                        <CardDescription className="text-xs">
                                          {study.description}
                                        </CardDescription>
                                      )}
                                    </div>
                                    {isTemplateForm && (
                                      <div className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>
                                </CardHeader>
                              </Card>
                              
                              {/* Expandable template list */}
                              {isTemplateForm && isTemplateExpanded && (
                                <div className="ml-4 space-y-2 pl-4 border-l-2 border-indigo-200">
                                  {availableTemplates.length > 0 ? (
                                    availableTemplates.map((template) => {
                                      const isTemplateSelected = selectedTemplateId === template.id;
                                      return (
                                        <Card
                                          key={template.id}
                                          className={`cursor-pointer transition-all ${
                                            isTemplateSelected
                                              ? "ring-2 ring-indigo-500 shadow-md bg-indigo-50"
                                              : "hover:shadow-sm hover:bg-indigo-50/30"
                                          }`}
                                          onClick={() => handleTemplateSelect(template.id)}
                                        >
                                          <CardHeader className="py-3">
                                            <div className="flex items-center gap-3">
                                              <div className="bg-indigo-500 p-1.5 rounded">
                                                <ClipboardList className="h-4 w-4 text-white" />
                                              </div>
                                              <div className="flex-1">
                                                <CardTitle className="text-sm font-medium">
                                                  {template.title}
                                                </CardTitle>
                                              </div>
                                              {isTemplateSelected && (
                                                <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                                              )}
                                            </div>
                                          </CardHeader>
                                        </Card>
                                      );
                                    })
                                  ) : (
                                    <div className="text-sm text-muted-foreground py-2">
                                      Шаблоны не найдены
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

          <div className="flex justify-between items-center gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={!currentDirection && !currentCategory && !expandedTemplateCategory && !selectedTemplateId}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Отмена
              </Button>
              <Button 
                onClick={handleCreateStudy} 
                disabled={!selectedType || isCreating}
              >
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={studyToDelete !== null} onOpenChange={(open) => !open && setStudyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить исследование?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Исследование будет удалено навсегда, включая все связанные изображения и сообщения.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteStudyMutation.isPending}
            >
              {deleteStudyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Удаление...
                </>
              ) : (
                "Удалить"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
