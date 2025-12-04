import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Save, Download, Loader2, Edit2, Eye, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function StudyView() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/study/:id");
  const studyId = params?.id ? parseInt(params.id) : null;
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [analysisResult, setAnalysisResult] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: study, isLoading, refetch } = useQuery({
    queryKey: ["study", studyId],
    queryFn: () => api.studies.get(studyId!),
    enabled: !!studyId,
  });

  const { data: chatMessages = [], refetch: refetchChat } = useQuery({
    queryKey: ["studyMessages", studyId],
    queryFn: () => api.studies.getMessages(studyId!),
    enabled: !!studyId,
  });

  const updateStudyMutation = useMutation({
    mutationFn: (data: { title?: string; analysisResult?: string }) =>
      api.studies.update(studyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study", studyId] });
    },
  });

  const downloadPDFMutation = useMutation({
    mutationFn: () => api.studies.downloadPDF(studyId!),
  });

  const sendChatMessageMutation = useMutation({
    mutationFn: (message: string) => api.studies.sendMessage(studyId!, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studyMessages", studyId] });
    },
  });

  useEffect(() => {
    if (study) {
      setTitle(study.title);
      setAnalysisResult(study.analysisResult || "");
    }
  }, [study]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSave = async () => {
    if (!studyId) return;

    setIsSaving(true);
    try {
      await updateStudyMutation.mutateAsync({
        title,
        analysisResult,
      });

      toast.success("Изменения сохранены");
      setIsEditing(false);
      refetch();
    } catch (error) {
      toast.error("Ошибка при сохранении");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!studyId) return;

    setIsDownloading(true);
    try {
      const result = await downloadPDFMutation.mutateAsync();

      // Convert base64 to blob
      const byteCharacters = atob(result.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("PDF загружен");
    } catch (error) {
      toast.error("Ошибка при загрузке PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!studyId || !chatMessage.trim()) return;

    setIsSendingMessage(true);
    try {
      await sendChatMessageMutation.mutateAsync(chatMessage.trim());

      setChatMessage("");
      refetchChat();
    } catch (error) {
      toast.error("Ошибка при отправке сообщения");
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!study) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-lg font-medium mb-4">Исследование не найдено</p>
          <Button onClick={() => navigate("/")}>Вернуться на главную</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">Результаты исследования</h1>
                <p className="text-sm text-muted-foreground">
                  {new Date(study.createdAt).toLocaleDateString("ru-RU", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isEditing ? (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Редактировать
                  </Button>
                  <Button onClick={handleDownload} disabled={isDownloading}>
                    {isDownloading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Загрузка...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Скачать PDF
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setTitle(study.title);
                      setAnalysisResult(study.analysisResult || "");
                    }}
                  >
                    Отмена
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Сохранение...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Сохранить
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Image Section */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Рентгеновский снимок</CardTitle>
            </CardHeader>
            <CardContent>
              {study.images && study.images.length > 0 ? (
                <div className="rounded-lg overflow-hidden border bg-black/5">
                  <img
                    src={study.images[0].url}
                    alt="X-Ray"
                    className="w-full h-auto object-contain max-h-96 mx-auto"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                  <p className="text-muted-foreground">Изображение не загружено</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analysis Section */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Результаты анализа</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title Field */}
              <div className="space-y-2">
                <Label htmlFor="title">Название исследования</Label>
                {isEditing ? (
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Введите название"
                  />
                ) : (
                  <p className="text-lg font-medium">{title}</p>
                )}
              </div>

              {/* Analysis Result Field with Scroll */}
              <div className="space-y-2">
                <Label htmlFor="analysis">Заключение</Label>
                {isEditing ? (
                  <Textarea
                    id="analysis"
                    value={analysisResult}
                    onChange={(e) => setAnalysisResult(e.target.value)}
                    placeholder="Введите результаты анализа"
                    className="font-mono text-sm"
                    rows={10}
                  />
                ) : (
                  <ScrollArea className="h-[400px] w-full rounded-lg border bg-muted/30 p-4">
                    <div className="prose prose-sm max-w-none">
                      {analysisResult ? (
                        <div className="whitespace-pre-wrap">{analysisResult}</div>
                      ) : (
                        <p className="text-muted-foreground italic">Результаты анализа отсутствуют</p>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Chat Section */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Вопросы к ИИ
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col h-[500px] overflow-hidden">
              {/* Chat Messages */}
              <ScrollArea className="flex-1 pr-4 mb-4 min-w-0 overflow-y-auto">
                <div className="space-y-4 min-w-0 pr-2">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Задайте вопрос по результатам исследования</p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} min-w-0`}
                      >
                        <div
                          className={`max-w-[80%] min-w-0 rounded-lg px-4 py-2 ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                        >
                          <p 
                            className="text-sm whitespace-pre-wrap"
                            style={{ 
                              wordBreak: 'break-word', 
                              overflowWrap: 'break-word',
                              hyphens: 'auto'
                            }}
                          >
                            {msg.content}
                          </p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(msg.createdAt).toLocaleTimeString("ru-RU", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              {/* Chat Input */}
              <div className="flex gap-2">
                <Textarea
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Задайте вопрос..."
                  className="resize-none"
                  rows={3}
                  disabled={isSendingMessage}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim() || isSendingMessage}
                  size="icon"
                  className="h-auto"
                >
                  {isSendingMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Study Info */}
        <Card className="mt-6 shadow-lg">
          <CardHeader>
            <CardTitle>Информация об исследовании</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Тип исследования</p>
                <p className="font-medium">
                  {study.studyType === "retinal_scan" && "Сканирование сетчатки"}
                  {study.studyType === "optic_nerve" && "Анализ зрительного нерва"}
                  {study.studyType === "macular_analysis" && "Анализ макулярной области"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Статус</p>
                <p className="font-medium">
                  {study.status === "draft" && "Черновик"}
                  {study.status === "analyzing" && "Анализ"}
                  {study.status === "completed" && "Завершено"}
                  {study.status === "error" && "Ошибка"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Дата создания</p>
                <p className="font-medium">
                  {new Date(study.createdAt).toLocaleString("ru-RU")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
